import React, { useState } from "react";
import { User } from "../types";
import { 
  Settings, User as UserIcon, CloudRain, Save, CheckCircle, HelpCircle, Thermometer, Info, Trash2
} from "lucide-react";

interface SettingsViewProps {
  user: User;
  userLocation: string;
  onUpdateProfile: (name: string, showPhEc?: boolean) => void;
  onUpdateLocation: (location: string) => void;
  onClearDBData?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  userLocation,
  onUpdateProfile,
  onUpdateLocation,
  onClearDBData
}) => {
  const [name, setName] = useState(user.name);
  const [showPhEc, setShowPhEc] = useState(user.showPhEc !== false);
  const [locationStr, setLocationStr] = useState(userLocation);
  const [savedName, setSavedName] = useState(false);
  const [savedLoc, setSavedLoc] = useState(false);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(name, showPhEc);
    setSavedName(true);
    setTimeout(() => setSavedName(false), 3000);
  };

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateLocation(locationStr);
    setSavedLoc(true);
    setTimeout(() => setSavedLoc(false), 3000);
  };

  return (
    <div id="settings-view-container" className="space-y-6 max-w-3xl mx-auto">
      
      {/* Settings Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-3">
        <div className="p-2.5 bg-emerald-50 rounded-xl">
          <Settings className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">アプリケーション設定</h2>
          <p className="text-slate-500 text-xs">栽培アカウント情報、AIで使用する地域・気象連携エリアを指定します。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
            <UserIcon className="w-4 h-4 text-emerald-600" /> アカウント情報
          </h3>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-500 text-xs font-bold mb-1.5 font-sans">
                登録メールアドレス (不変)
              </label>
              <input 
                type="text" 
                value={user.email} 
                disabled 
                className="w-full px-4 py-2 text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-500 text-xs font-bold mb-1.5 font-sans">
                表示ユーザー名
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 text-base md:text-xs bg-white border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-xl text-slate-700"
              />
            </div>

            <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
              <input 
                type="checkbox" 
                id="showPhEc" 
                checked={showPhEc} 
                onChange={(e) => setShowPhEc(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
              />
              <div className="flex-1">
                <label htmlFor="showPhEc" className="text-slate-700 text-xs font-bold font-sans select-none cursor-pointer block">
                  pH・EC測定の高度な水質管理をサポートする
                </label>
                <span className="text-[10px] text-slate-400 leading-snug block mt-0.5">
                  チェックを外すと、pHやEC値、水温の入力フォームが非表示になり、カレンダーのAI提案でも水質測定タスクが提案されなくなります。
                </span>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" /> 設定を保存
            </button>

            {savedName && (
              <div className="text-emerald-600 text-[11px] font-bold text-center flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> 表示名を変更しました！
              </div>
            )}
          </form>
        </div>

        {/* Dynamic Weather Climate Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
              <CloudRain className="w-4 h-4 text-emerald-600" /> 地域・気象連携エリア設定
            </h3>

            <p className="text-slate-500 text-[11px] leading-relaxed mb-4">
              お住まいの地域名（例: <span className="font-bold text-slate-700">「長野県長野市」「北海道札幌市」「東京都」</span>など）を設定します。
              AIチャットやカレンダー提案時に、現在の季節に応じた外気温や湿度等の地域統計情報（Gemini Search Grounding）を自動考慮します。
            </p>

            <form onSubmit={handleLocationSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-500 text-xs font-bold mb-1.5 font-sans">
                  栽培地域名
                </label>
                <input 
                  type="text" 
                  value={locationStr} 
                  onChange={(e) => setLocationStr(e.target.value)}
                  placeholder="例: 長野県長野市"
                  className="w-full px-4 py-2.5 text-base md:text-xs bg-white border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-xl text-slate-700 font-sans"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" /> 栽培地域を紐付ける
              </button>

              {savedLoc && (
                <div className="text-emerald-700 text-[11px] font-bold text-center flex items-center justify-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> 栽培コーディネート気候エリアを反映しました！
                </div>
              )}
            </form>
          </div>

          <div className="mt-3 p-3 bg-teal-50/50 rounded-xl border border-teal-100 text-[10px] text-teal-800 flex gap-1.5">
            <Info className="w-4 h-4 shrink-0 text-teal-600" />
            <span>冷涼地（長野・北陸等）では冬場の水温底冷え対策、都市部マンションでは夏場の密閉熱による根腐れ等、AIが自動解析対応します。</span>
          </div>
        </div>

      </div>

      {/* Info Hydroponic parameters cheat card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
          <HelpCircle className="w-4 h-4 text-emerald-600" /> 水耕栽培 水質管理の基準
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span> 基準pH範囲
            </div>
            <div className="text-base font-extrabold text-slate-800 font-mono">5.8 〜 6.5</div>
            <p className="text-[10px] text-slate-400 leading-snug">弱酸性が基本。7.0を超えると鉄やマグネシウム等の金属微量要素の吸収が阻害され、葉が黄化します。</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span> 標準電気伝導度 EC値
            </div>
            <div className="text-base font-extrabold text-slate-800 font-mono">1.0 〜 2.5</div>
            <p className="text-[10px] text-slate-400 leading-snug">単位は mS/cm（葉物: 1.0〜1.6 / 果実: 2.0〜2.5）。高すぎると肥料焼けを起こし、低すぎると成長が遅れます。</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> 理想水温
            </div>
            <div className="text-base font-extrabold text-slate-800 font-mono">18℃ 〜 22℃</div>
            <p className="text-[10px] text-slate-400 leading-snug">25℃を超えると液体内の溶存酸素量が急激に下がり、最も恐ろしい根腐れ（カビ菌増殖）の原因となります。</p>
          </div>
        </div>
      </div>
    </div>
  );
};
