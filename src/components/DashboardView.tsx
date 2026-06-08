import React, { useState, useEffect } from "react";
import { 
  User, System, Plant, ScheduleProposal, ProposalStatus, ProposalType, HarvestPrediction 
} from "../types";
import { 
  Plus, Calendar, Activity, AlertCircle, Droplets, 
  Settings, Check, X, ShieldAlert, Users, CloudRain, CheckCircle, Sprout, Loader2,
  CalendarClock, Sparkles, Timer, ChevronRight, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
  weatherAdvice: string | null;
  loadingWeather: boolean;
  weatherError: string | null;
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
  weatherAdvice,
  loadingWeather,
  weatherError,
  onRefreshPredictions,
  onApproveProposal,
  onCompleteProposalTask,
  onNavigateToTab,
  onSelectPlant,
  onAddSystemClick
}) => {
  const [toastMsg, setToastMsg] = useState("");
  const [expandedReasonId, setExpandedReasonId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  const triggerLocalToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTaskIds(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const activePlantIds = plants.filter(p => !p.archived && !systems.find(sys => sys.id === p.systemId)?.suspended).map(p => p.id);
  const activePlants = plants.filter(p => !p.archived && !systems.find(sys => sys.id === p.systemId)?.suspended);

  // Filter pending proposals for this user
  const pendingProposals = proposals.filter(p => p.status === "pending" && activePlantIds.includes(p.plantId));
  const approvedToday = proposals.filter(p => {
    if (p.status !== "approved" && p.status !== "pending") return false;
    if (!activePlantIds.includes(p.plantId)) return false;
    const todayStr = new Date().toISOString().split("T")[0];
    return p.proposedDate === todayStr;
  });

  return (
    <div id="dashboard-view-container" className="space-y-5">
      {/* 1. Welcome & Location Header */}
      <div id="welcome-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <span className="text-[10px] text-emerald-600 font-mono tracking-wider uppercase font-extrabold">OVERVIEW</span>
          <h2 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight mt-0.5">おかえりなさい、{user.name} さん 🌱</h2>
        </div>
      </div>

      {/* 2. AI Weather Advice & Cultivation Location Merged Box */}
      <div id="weather-advice-banner" className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/10 p-3.5 rounded-xl flex gap-3 animate-in fade-in slide-in-from-top-3 duration-300">
        <div className="bg-emerald-100/40 p-2 rounded-xl text-emerald-700 shrink-0 self-start">
          <CloudRain className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {loadingWeather ? (
              <span className="text-[9.5px] text-teal-600 font-bold flex items-center gap-1 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-teal-500" />
                気候アドバイス取得中...
              </span>
            ) : (
              <span className="text-[9.5px] bg-teal-600/10 text-teal-700 font-extrabold px-2 py-0.5 rounded-md tracking-wider">
                AI気候アドバイス
              </span>
            )}
            <span className="text-[9.5px] bg-emerald-600/10 text-emerald-700 font-extrabold px-2 py-0.5 rounded-md tracking-wider">
              栽培設定地域: {userLocation || "未設定 (通常暖地)"}
            </span>
            {weatherError && (
              <span className="text-[9px] text-amber-600 font-bold">
                ⚠️ ローカルモード
              </span>
            )}
          </div>
          
          {loadingWeather ? (
            <p className="text-slate-400 text-xs font-semibold animate-pulse">
              現在の地域に合わせた最新の栽培気候アドバイスを生成しています... 💫
            </p>
          ) : weatherAdvice ? (
            <p className="text-slate-750 text-xs leading-relaxed font-bold">
              {weatherAdvice}
            </p>
          ) : (
            <p className="text-slate-505 text-xs font-bold leading-relaxed">
              現在、この地域に関する特別な気候注意報はありません。引き続き順調な栽培をサポートします。 🌱
            </p>
          )}
        </div>
      </div>

      {/* 3. Stats & Tasks Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Statistics Widgets */}
        <div className="md:col-span-1 grid grid-cols-2 gap-4">
          <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 p-4 rounded-xl flex flex-col justify-between transition-colors whitespace-normal">
            <span className="text-[10px] text-slate-450 font-bold tracking-wider uppercase block">プランター</span>
            <div className="text-2xl font-black text-slate-800 mt-2">{systems.length} <span className="text-xs font-normal text-slate-400">個</span></div>
          </div>
          <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 p-4 rounded-xl flex flex-col justify-between transition-colors whitespace-normal">
            <span className="text-[10px] text-slate-450 font-bold tracking-wider uppercase block">栽培中の植物</span>
            <div className="text-2xl font-black text-slate-800 mt-2">{activePlants.length} <span className="text-xs font-normal text-slate-400">株</span></div>
          </div>
        </div>

        {/* Task Controller */}
        <div className="md:col-span-2 bg-white p-4.5 rounded-xl border border-slate-100 shadow-3xs flex flex-col justify-between whitespace-normal">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800 tracking-wider">本日実施のお世話タスク</span>
            </div>
            <button 
              onClick={() => onNavigateToTab("calendar")}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold transition-all"
            >
              カレンダー →
            </button>
          </div>

          {approvedToday.length === 0 ? (
            <div className="text-center py-5 bg-slate-50/60 rounded-xl text-slate-400 text-xs border border-dashed border-slate-200 font-bold">
              本日予定されているお世話はこちらで完了、またはありません
            </div>
          ) : (
            <div className="space-y-2">
              {approvedToday.map((item, idx) => {
                const itemId = item.id || `task-${idx}`;
                const isExpanded = !!expandedTaskIds[itemId];

                // noteの最初の句点、改行、または全角半角カッコの手前を簡潔な見出しタイトルとして切り出す
                const titleMatch = item.note.match(/^[^。\n（(]+/);
                const displayTitle = titleMatch ? titleMatch[0].trim() : item.note;

                return (
                  <div 
                    key={itemId} 
                    id={`task-accordion-${itemId}`}
                    className="bg-white border border-slate-100/80 rounded-xl overflow-hidden transition-shadow hover:shadow-2xs"
                  >
                    {/* Accordion Header */}
                    <div 
                      onClick={() => toggleTaskExpand(itemId)}
                      className="p-3 bg-emerald-50/10 hover:bg-emerald-50/30 flex items-center justify-between gap-3 select-none cursor-pointer"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-emerald-850 text-[9px] bg-emerald-100/40 px-1.5 py-0.2 rounded">
                            {item.type === 'nutrient' ? '🧪 施肥' : item.type === 'water_change' ? '💧 水換' : item.type === 'ph_check' ? '📊 pH' : item.type === 'watering' ? '🚿 水やり' : item.type === 'pruning' ? '✂️ 剪定' : '📋 お世話'}
                          </span>
                          <span className="font-mono text-[9px] text-slate-400 bg-white px-1.5 py-0.2 rounded border border-slate-100 truncate max-w-[120px]">
                            {item.plantName}
                          </span>
                        </div>
                        <p className="text-slate-700 font-bold text-xs truncate">
                          {displayTitle}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                        <span className="text-[9px] font-bold text-slate-400 hidden sm:inline">
                          {isExpanded ? "閉じる" : "詳細を開く"}
                        </span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-250 ${isExpanded ? "rotate-90 text-emerald-600" : ""}`} />
                      </div>
                    </div>

                    {/* Accordion Body with framer-motion smooth animation */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 bg-slate-50/50 border-t border-slate-100/40 text-xs text-slate-650 space-y-3">
                            <div className="space-y-1 font-semibold leading-relaxed">
                              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">お世話メモ・アドバイス詳細</span>
                              <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100 font-bold whitespace-pre-wrap">{item.note}</p>
                            </div>

                            {onCompleteProposalTask && (
                              <div className="flex justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await onCompleteProposalTask(item);
                                      triggerLocalToast(`「${item.note.substring(0, 10)}...」をお世話ログに自動記録しました。`);
                                    } catch (e) {
                                      console.error(e);
                                      triggerLocalToast("エラーが発生しました。");
                                    }
                                  }}
                                  className="px-3.5 py-1.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all rounded-lg flex items-center gap-1 cursor-pointer shadow-3xs"
                                >
                                  <Check className="w-3 h-3" />
                                  完了にする
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Planter Systems lists */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
              <Sprout className="w-4 h-4 text-emerald-600" /> プランターと栽培中の植物
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await onRefreshPredictions(true);
                triggerLocalToast("🌱 AI収穫予測を再計算しました");
              }}
              disabled={loadingPredictions}
              className="px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 select-none"
            >
              <RefreshCw className={`w-3 h-3 ${loadingPredictions ? "animate-spin" : ""}`} />
              {loadingPredictions ? "計算中..." : "収穫予測を更新"}
            </button>
            <button 
              onClick={onAddSystemClick}
              className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> 追加
            </button>
          </div>
        </div>

        {systems.filter(sys => !sys.suspended).length === 0 ? (
          <div className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs font-semibold">
            現在、稼働状態のプランターはありません
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {systems.filter(sys => !sys.suspended).map((sys) => {
              const sysPlants = plants.filter(p => p.systemId === sys.id && !p.archived);

              return (
                <div key={sys.id} id={`system-card-${sys.id}`} className="bg-white rounded-2xl border border-slate-100 shadow-3xs overflow-hidden flex flex-col justify-between">
                  {/* Card Header & Body */}
                  <div className="p-4.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100/60 font-sans">
                        {sys.type === 'DWC' ? '水耕プランター (DWC)' : sys.type === 'NFT' ? '水耕プランター (NFT)' : sys.type === 'Kratky' ? '静置水耕プランター' : sys.type === 'Soil_Planter' ? '土耕用プランター' : sys.type === 'Backyard_Field' ? '屋外設置プランター' : '栽培用プランター'}
                      </span>
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">稼働中</span>
                    </div>

                    <h4 className="font-extrabold text-slate-850 text-sm mt-2">
                      {sys.name}
                    </h4>
                    {sys.description && (
                      <p className="text-slate-450 text-[10.5px] mt-0.5 line-clamp-1 leading-relaxed">{sys.description}</p>
                    )}

                    {/* Associated Plant list inside the specific System container */}
                    <div className="mt-3.5 pt-3 border-t border-slate-50">
                      <div className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wide mb-2">
                        植物一覧 ({sysPlants.length})
                      </div>
                      
                      {sysPlants.length === 0 ? (
                        <div className="text-xs text-slate-400 italic py-1">登録されている植物はありません</div>
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
                                className="p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-2 transition-all"
                              >
                                {/* Header Details: Title and Sowing date */}
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onSelectPlant(p.id)}>
                                    <div className="text-xs font-extrabold text-slate-800 hover:text-emerald-700 hover:underline transition-colors truncate">{p.name}</div>
                                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">播種: {p.sowingDate}</div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {p.members && p.members.length > 1 && (
                                      <span className="text-[8.5px] bg-slate-100 border border-slate-200 text-slate-500 px-1 py-0.2 rounded font-mono font-bold">共同</span>
                                    )}
                                    <span className={`text-[8.5px] px-1.5 py-0.2 rounded border font-bold ${stageColor}`}>
                                      {stageLabel}
                                    </span>
                                  </div>
                                </div>

                                {/* Expected Harvest visual container */}
                                {expDateStr && (
                                  <div className="bg-white p-2 border border-slate-100/50 rounded-lg flex items-center justify-between text-[9px] font-sans">
                                    <span className="text-slate-450 font-mono">
                                      収穫予想: {expDateStr}
                                    </span>
                                    {daysLeft !== null && (
                                      <span className={`font-mono font-black ${daysLeft < 0 ? "text-rose-600" : daysLeft <= 3 ? "text-amber-600 animate-pulse" : daysLeft <= 10 ? "text-emerald-700" : "text-slate-500"}`}>
                                        {daysLeft < 0 ? `経過 +${Math.abs(daysLeft)}日` : daysLeft <= 3 ? `🔥 収穫適期!` : `あと ${daysLeft}日`}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Interactive mobile prediction advice */}
                                {prediction?.reason && (
                                  <div className="pt-1.5 border-t border-slate-100/40">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        setExpandedReasonId(expandedReasonId === p.id ? null : p.id);
                                      }}
                                      className="text-[9px] text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100/85 px-2 py-0.8 rounded-md font-bold inline-flex items-center gap-1 transition-all"
                                    >
                                      <Sparkles className="w-2.5 h-2.5 text-teal-500 shrink-0" />
                                      {expandedReasonId === p.id ? "アドバイスを閉じる" : "AIアドバイスを見る"}
                                    </button>
                                    
                                    {expandedReasonId === p.id && (
                                      <div className="mt-1.5 p-2 bg-teal-50/20 border border-teal-150/15 rounded-lg text-[9px]/relaxed text-slate-650 font-bold animate-in fade-in slide-in-from-top-1 duration-200">
                                        💡 {prediction.reason}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-4.5 py-2.5 border-t border-slate-50 bg-slate-50/50 text-right">
                    <button 
                      onClick={() => onNavigateToTab("systems")}
                      className="text-[10.5px] font-extrabold text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      プランター管理 →
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
