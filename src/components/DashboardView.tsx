import React, { useState, useEffect } from "react";
import { 
  User, System, Plant, ScheduleProposal, ProposalStatus, ProposalType, HarvestPrediction 
} from "../types";
import { 
  Plus, Calendar, Activity, AlertCircle, Droplets, 
  Settings, Check, X, ShieldAlert, Users, CloudRain, CheckCircle, Sprout, Loader2,
  CalendarClock, Sparkles, Timer, ChevronRight, RefreshCw
} from "lucide-react";

interface DashboardViewProps {
  user: User;
  systems: System[];
  plants: any[]; // Hydrated plants
  proposals: any[];
  userLocation: string;
  token?: string | null;
  predictions: HarvestPrediction[];
  lastCalcAt: string;
  loadingPredictions: boolean;
  predictionsError?: string | null;
  onRefreshPredictions: (force: boolean) => Promise<void>;
  onApproveProposal: (id: string, status: ProposalStatus) => void;
  onCompleteProposalTask?: (task: any) => Promise<void>;
  onNavigateToTab: (tab: string) => void;
  onSelectPlant: (plantId: string) => void;
  onAddSystemClick: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  systems,
  plants,
  proposals,
  userLocation,
  token,
  predictions,
  lastCalcAt,
  loadingPredictions,
  predictionsError,
  onRefreshPredictions,
  onApproveProposal,
  onCompleteProposalTask,
  onNavigateToTab,
  onSelectPlant,
  onAddSystemClick
}) => {
  const [toastMsg, setToastMsg] = useState("");
  const [weatherAdvice, setWeatherAdvice] = useState<string | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchWeatherAdvice = async () => {
      setLoadingWeather(true);
      setWeatherError(null);
      try {
        const headers: { [key: string]: string } = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(`/api/weather-advice?location=${encodeURIComponent(userLocation || "長野県長野市")}`, {
          headers
        });
        if (res.ok) {
          const data = await res.json();
          if (active && data.advice) {
            setWeatherAdvice(data.advice);
          }
          if (active && data.geminiError) {
            setWeatherError(data.geminiError);
          }
        }
      } catch (err) {
        console.error("Failed to fetch climate/weather advice:", err);
      } finally {
        if (active) setLoadingWeather(false);
      }
    };

    fetchWeatherAdvice();
    return () => {
      active = false;
    };
  }, [userLocation, token]);

  const triggerLocalToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  const activePlantIds = plants.filter(p => !p.archived).map(p => p.id);
  const activePlants = plants.filter(p => !p.archived);

  // Filter pending proposals for this user
  const pendingProposals = proposals.filter(p => p.status === "pending" && activePlantIds.includes(p.plantId));
  const approvedToday = proposals.filter(p => {
    if (p.status !== "approved") return false;
    if (!activePlantIds.includes(p.plantId)) return false;
    const todayStr = new Date().toISOString().split("T")[0];
    return p.proposedDate === todayStr;
  });

  return (
    <div id="dashboard-view-container" className="space-y-6">
      {/* AI Weather Advice Alert Box */}
      {loadingWeather ? (
        <div id="weather-advice-loading" className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-2xs flex items-center gap-3 animate-pulse">
          <Loader2 className="w-5 h-5 text-teal-600 animate-spin shrink-0" />
          <span className="text-xs text-slate-500 font-bold font-sans">
            地域の最新気象情報をふまえて、Gemini AIが栽培アドバイスを生成中... 🌱
          </span>
        </div>
      ) : weatherAdvice ? (
        <div id="weather-advice-banner" className="bg-gradient-to-br from-teal-50/70 to-emerald-50/55 border border-emerald-100/60 p-4.5 rounded-2xl shadow-3xs flex gap-3.5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-100/60 p-2.5 rounded-xl text-emerald-700 shrink-0 self-start md:self-center">
            <CloudRain className="w-5 h-5 text-emerald-600 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] bg-teal-600 text-white font-mono font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide">
                AI園芸気候アラート
              </span>
              <span className="text-[10px] text-slate-500 font-bold font-mono">
                {userLocation || "未設定の地域"}
              </span>
              {weatherError && (
                <span className="text-[9px] bg-amber-50 text-amber-600 font-bold border border-amber-200/50 px-2 py-0.5 rounded-md animate-pulse">
                  {weatherError === "quota_exceeded" ? "⚠️ Gemini利用上限のためローカルモデルで動作中" : "⚠️ AI通信制限のためローカル機能で動作中"}
                </span>
              )}
            </div>
            <p className="text-slate-700 text-xs md:text-xs/relaxed leading-relaxed font-semibold">
              {weatherAdvice}
            </p>
          </div>
        </div>
      ) : null}

      {/* Welcome Banner */}
      <div id="welcome-banner" className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-emerald-100 text-xs font-mono tracking-wider uppercase">Smart Garden OS</span>
          <h2 className="text-2xl font-bold tracking-tight mt-1">おかえりなさい、{user.name} さん 🌱</h2>
          <p className="text-emerald-50 text-sm mt-1 max-w-xl">
            AI連携による高精度スケジュールと、スマート育成記録により、家庭菜園、ベランダプランター、お部屋での栽培管理をパーフェクトにサポートします。
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 self-start md:self-auto">
          <CloudRain className="w-5 height-5 text-emerald-200" />
          <div>
            <div className="text-xs text-emerald-200 font-medium">栽培設定地域</div>
            <div className="text-sm font-bold">{userLocation || "未設定 (通常暖地)"}</div>
          </div>
        </div>
      </div>

      {/* Grid of Main Stats & Today's Auto-Approved Schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Statistics Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" /> プランター統計
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl">
                <span className="text-xs text-slate-500 font-medium">プランター鉢・環境</span>
                <div className="text-2xl font-bold text-slate-800 mt-1">{systems.length} <span className="text-xs font-normal">個</span></div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <span className="text-xs text-slate-500 font-medium font-sans">栽培中の植物</span>
                <div className="text-2xl font-bold text-slate-800 mt-1">{activePlants.length} <span className="text-xs font-normal">株</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Today Tasks Column (Now wider, 2/3 of space, very clean and easy to check off!) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-550 uppercase tracking-wider mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                本日実施のお世話タスク (AI自動登録)
              </div>
              <button 
                onClick={() => onNavigateToTab("calendar")}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold"
              >
                カレンダーをみる →
              </button>
            </h3>
            <p className="text-slate-500 text-xs mb-4">
              お世話スケジュールはAIが診断時に自動計算・登録してカレンダーに反映されています。実施したら「実施完了にする」をクリックしましょう！
            </p>
          </div>

          {approvedToday.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl text-slate-400 text-xs border border-dashed border-slate-200">
              <span className="text-2xl">🌱</span>
              <p className="font-bold text-slate-650 mt-1">本日実施予定のタスクはすべて完了、またはありません！</p>
              <button 
                onClick={() => onNavigateToTab("calendar")}
                className="mt-2 text-emerald-600 font-bold hover:underline"
              >
                全体のカレンダーを確認する
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {approvedToday.map((item, idx) => (
                <div key={item.id || idx} className="p-3.5 bg-emerald-50/40 hover:bg-emerald-50/70 border border-emerald-100/60 rounded-xl text-xs flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center transition-colors">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-emerald-800 text-xs bg-emerald-100/60 px-2 py-0.5 rounded-md">
                        {item.type === 'nutrient' ? '🧪 施肥希釈' : item.type === 'water_change' ? '💧 全水換え' : item.type === 'ph_check' ? '📊 pH測定' : item.type === 'watering' ? '🚿 水やり推奨' : item.type === 'pruning' ? '✂️ 芽かき・剪定' : '📋 お世話タスク'}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {item.plantName}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed font-sans">{item.note}</p>
                  </div>
                  {onCompleteProposalTask && (
                    <div className="flex self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await onCompleteProposalTask(item);
                            triggerLocalToast(`タスク「${item.note.substring(0, 12)}...」を達成完了とし、栽培日記に自動記録しました！`);
                          } catch (e) {
                            console.error(e);
                            triggerLocalToast("タスクの完了処理中にエラーが発生しました。");
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] transition-all rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        実施完了にする
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Systems grid and Plant lists */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Sprout className="w-5 h-5 text-emerald-600" /> マイプランターと植物一覧
            </h3>
            {lastCalcAt && (
              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>AI収穫更新: 週2回(3日おき) | 前回実行: {new Date(lastCalcAt).toLocaleString("ja-JP")}</span>
                {predictionsError && (
                  <span className="text-[9px] bg-amber-50 text-amber-600 font-bold border border-amber-200/40 px-1.5 py-0.2 rounded">
                    {predictionsError === "quota_exceeded" ? "⚠️ Gemini上限のためローカル予測中" : "⚠️ AI通信制限のためローカル安全予測中"}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await onRefreshPredictions(true);
                triggerLocalToast("🌱 最新の成長・お世話ログから、AI収穫予測値を再計算しました！");
              }}
              disabled={loadingPredictions}
              className="px-3.5 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 select-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPredictions ? "animate-spin" : ""}`} />
              {loadingPredictions ? "AI計算中..." : "AI収穫予測の更新"}
            </button>
            <button 
              onClick={onAddSystemClick}
              className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-1 transition-colors"
            >
              <Plus className="w-4 h-4" /> プランターを追加
            </button>
          </div>
        </div>

        {systems.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
            プランター鉢や栽培環境が登録されていません。まずはプランターや菜園、栽培槽を登録しましょう！
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {systems.map((sys) => {
              // Plants in this system
              const sysPlants = plants.filter(p => p.systemId === sys.id && !p.archived);

              return (
                <div key={sys.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex flex-col overflow-hidden">
                  <div className="p-5 border-b border-slate-50 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {sys.type === 'DWC' ? 'DWC (深水水耕)' : sys.type === 'NFT' ? 'NFT (薄膜水耕)' : sys.type === 'Kratky' ? 'Kratky (静置ボトル)' : sys.type === 'Soil_Planter' ? '土耕プランター' : sys.type === 'Backyard_Field' ? '家庭菜園・庭畑' : 'その他環境'}
                      </span>
                      <span className={`w-2.5 h-2.5 rounded-full inline-block ${sys.suspended ? "bg-slate-350" : "bg-emerald-500"}`} title={sys.suspended ? "休止中" : "稼働中"}></span>
                    </div>

                    <h4 className="font-bold text-slate-800 text-base mt-2.5 flex items-center gap-1.5">
                      {sys.name}
                      {sys.suspended && <span className="text-xs bg-slate-100 text-slate-500 font-normal px-2 py-0.5 rounded">休止中</span>}
                    </h4>
                    <p className="text-slate-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">{sys.description || "説明はありません。"}</p>

                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <div className="text-xs text-slate-400 font-medium font-sans mb-2">栽培中の植物 ({sysPlants.length}) :</div>
                      {sysPlants.length === 0 ? (
                        <div className="text-xs text-slate-400 italic py-1">植物が登録されていません</div>
                      ) : (
                        <div className="space-y-2">
                          {sysPlants.map(p => {
                            let stageLabel = "栄養期";
                            let stageColor = "text-sky-700 bg-sky-50 border-sky-100";
                            if (p.stage === "seedling") { stageLabel = "苗期"; stageColor = "text-amber-700 bg-amber-50 border-amber-100"; }
                            else if (p.stage === "flowering") { stageLabel = "開花期"; stageColor = "text-rose-700 bg-rose-50 border-rose-100"; }
                            else if (p.stage === "harvest") { stageLabel = "収穫期"; stageColor = "text-emerald-700 bg-emerald-50 border-emerald-100"; }
                            else if (p.stage === "finished") { stageLabel = "栽培終了"; stageColor = "text-slate-500 bg-slate-100 border-slate-200"; }

                            const prediction = predictions.find(pred => pred.plantId === p.id);
                            const expDateStr = prediction?.calculatedHarvestDate || p.expectedHarvestDate;

                            const getDaysLeft = (dateStr: string) => {
                              const today = new Date();
                              today.setHours(0,0,0,0);
                              const exp = new Date(dateStr);
                              exp.setHours(0,0,0,0);
                              const diff = exp.getTime() - today.getTime();
                              return Math.ceil(diff / (1000 * 60 * 60 * 24));
                            };

                            const daysLeft = expDateStr ? getDaysLeft(expDateStr) : null;

                            return (
                              <div 
                                key={p.id} 
                                onClick={() => onSelectPlant(p.id)}
                                className="flex flex-col gap-1.5 p-3 hover:bg-slate-50/80 rounded-xl cursor-pointer border border-slate-100 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-slate-800">{p.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">播種: {p.sowingDate}</div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {p.members && p.members.length > 1 && (
                                      <Users className="w-3.5 h-3.5 text-emerald-600" title="共同栽培推進中" />
                                    )}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${stageColor}`}>
                                      {stageLabel}
                                    </span>
                                  </div>
                                </div>

                                {expDateStr && (
                                  <div className="mt-1 flex items-center justify-between bg-emerald-50/20 px-2.5 py-1.5 rounded-lg text-[9.5px] border border-emerald-100/30">
                                    <span className="text-slate-500 font-mono">
                                      予測収穫: {expDateStr}
                                    </span>
                                    {daysLeft !== null && (
                                      <span className={`font-mono font-bold ${daysLeft < 0 ? "text-rose-600" : daysLeft <= 3 ? "text-amber-600 font-extrabold animate-pulse" : daysLeft <= 10 ? "text-emerald-750" : "text-slate-600"}`}>
                                        {daysLeft < 0 ? `(経過 +${Math.abs(daysLeft)}日)` : daysLeft <= 3 ? `(🔥 収穫適期! あと${daysLeft}日)` : `(あと ${daysLeft} 日)`}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {prediction?.reason && (
                                  <p className="text-[9px]/relaxed text-slate-500 italic mt-0.5 font-medium" title={prediction.reason}>
                                    💡 {prediction.reason}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-3 border-t border-slate-50 bg-slate-50 text-right">
                    <button 
                      onClick={() => onNavigateToTab("systems")}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      プランター管理・植物を追加 →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-[1000] flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
