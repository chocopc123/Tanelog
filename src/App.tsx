import React, { useState, useEffect } from "react";
import { 
  User, System, Plant, ScheduleProposal, ProposalStatus, SystemType, PlantStage, HarvestPrediction 
} from "./types";
import { DashboardView } from "./components/DashboardView";
import { CalendarView } from "./components/CalendarView";
import { SystemPlantsView } from "./components/SystemPlantsView";
import { SettingsView } from "./components/SettingsView";
import { 
  Activity, Calendar as CalendarIcon, Droplets, Settings, LogOut, Sprout, ShieldAlert, CloudRain, CheckSquare, Sparkles 
} from "lucide-react";

export default function App() {
  // Helper to sanitize token from non-ASCII/control characters
  const getCleanToken = (): string | null => {
    const raw = localStorage.getItem("hydro_token");
    if (!raw) return null;
    return raw.replace(/[^\x21-\x7E]/g, "");
  };

  // Authentication & Session
  const [token, setToken] = useState<string | null>(getCleanToken());
  const [user, setUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState("choco.rgi.duck@gmail.com"); // Prefilled default user for seamless UX testing
  const [loginName, setLoginName] = useState("栽培マスター");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");

  // Navigation Panel Tab
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Global Models State
  const [systems, setSystems] = useState<System[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedPlantDetails, setSelectedPlantDetails] = useState<any | null>(null);
  const [userLocation, setUserLocation] = useState<string>(localStorage.getItem("hydro_location") || "長野県長野市");
  const [predictions, setPredictions] = useState<HarvestPrediction[]>([]);
  const [lastCalcAt, setLastCalcAt] = useState<string>("");
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);

  // Loading Feedback
  const [loading, setLoading] = useState(false);

  // Synchronous initial fetch
  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      syncDatabase();
      fetchPredictions(false);
    }
  }, [user]);

  // Periodic slow polling to fetch any co-cultivator edits
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (user) {
      interval = setInterval(() => {
        syncDatabase(true);
        fetchPredictions(false);
      }, 15000);
    }
    return () => clearInterval(interval);
  }, [user]);

  const fetchPredictions = async (force: boolean = false) => {
    if (!token) return;
    setLoadingPredictions(true);
    try {
      const res = await fetch(`/api/plants/harvest-predictions?force=${force}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.predictions) {
          setPredictions(data.predictions);
        }
        if (data.lastHarvestCalculationAt) {
          setLastCalcAt(data.lastHarvestCalculationAt);
        }
        if (data.geminiError) {
          setPredictionsError(data.geminiError);
        } else {
          setPredictionsError(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch harvest predictions:", err);
    } finally {
      setLoadingPredictions(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Clear stale credentials safely
        handleLogout();
      }
    } catch (e) {
      console.error("Failed to load user profile", e);
    }
  };

  const syncDatabase = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const headerAuth = { "Authorization": `Bearer ${token}` };

      const [resSys, resPlants, resProps] = await Promise.all([
        fetch("/api/systems", { headers: headerAuth }),
        fetch("/api/plants", { headers: headerAuth }),
        fetch("/api/proposals", { headers: headerAuth })
      ]);

      if (resSys.ok && resPlants.ok && resProps.ok) {
        const sysData = await resSys.json();
        const plantData = await resPlants.json();
        const propsData = await resProps.json();

        setSystems(sysData);
        setPlants(plantData);
        setProposals(propsData);

        // Auto re-hydrate detailed plant if it is currently selected
        if (selectedPlantDetails) {
          const freshDetailsRes = await fetch(`/api/plants/${selectedPlantDetails.id}`, { headers: headerAuth });
          if (freshDetailsRes.ok) {
            const fd = await freshDetailsRes.json();
            setSelectedPlantDetails(fd);
          }
        }
      }
    } catch (e) {
      console.error("Database status synchronization failed:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Auth Operations
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const ep = isRegistering ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegistering ? { email: loginEmail, name: loginName } : { email: loginEmail };

      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        const cleanTok = String(data.token || "").replace(/[^\x21-\x7E]/g, "");
        localStorage.setItem("hydro_token", cleanTok);
        setToken(cleanTok);
        setUser(data.user);
      } else {
        setAuthError(data.error || "認証時に予期せぬエラーが発生しました");
      }
    } catch (err) {
      setAuthError("サーバーへの接続エラーです。接続環境等をご確認ください。");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("hydro_token");
    setToken(null);
    setUser(null);
    setSelectedPlantDetails(null);
    setSystems([]);
    setPlants([]);
    setProposals([]);
  };

  // Systems operations
  const handleCreateSystem = async (name: string, type: SystemType, description: string) => {
    try {
      const res = await fetch("/api/systems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name, type, description })
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSystem = async (id: string) => {
    try {
      const res = await fetch(`/api/systems/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateSystem = async (id: string, payload: any) => {
    try {
      const res = await fetch(`/api/systems/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Plant operations
  const handleCreatePlant = async (payload: { systemId: string, name: string, variety: string, stage: PlantStage, sowingDate: string, expectedHarvestDate: string }) => {
    try {
      const res = await fetch("/api/plants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectDetailedPlant = async (id: string | null) => {
    if (!id) {
      setSelectedPlantDetails(null);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/plants/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const details = await res.json();
        setSelectedPlantDetails(details);
        setActiveTab("systems"); // Instantly switch tab view focused on details
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlant = async (id: string, payload: any) => {
    try {
      const res = await fetch(`/api/plants/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePlant = async (id: string) => {
    try {
      const res = await fetch(`/api/plants/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedPlantDetails(null);
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Logs adding
  const handleAddGrowLog = async (payload: { plantId: string, ph: string, ec: string, waterTemp: string, note: string, watered?: boolean, imageUrl?: string, imageUrls?: string[] }) => {
    try {
      const res = await fetch("/api/grow-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddNutringLog = async (payload: { plantId: string, brand: string, dilutionRate: string, amountMl: string, note: string }) => {
    try {
      const res = await fetch("/api/nutrient-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateNutrientLog = async (id: string, payload: any) => {
    try {
      const res = await fetch(`/api/nutrient-logs/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNutrientLog = async (id: string) => {
    try {
      const res = await fetch(`/api/nutrient-logs/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        await syncDatabase();
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "施肥履歴の削除に失敗しました。");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "削除中にエラーが発生しました。");
      throw e;
    }
  };

  const handleUpdateGrowLog = async (id: string, payload: any) => {
    try {
      const res = await fetch(`/api/grow-logs/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await syncDatabase();
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "測定履歴の更新に失敗しました。");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "更新中にエラーが発生しました。");
      throw e;
    }
  };

  const handleDeleteGrowLog = async (id: string) => {
    try {
      const res = await fetch(`/api/grow-logs/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        await syncDatabase();
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "測定履歴の削除に失敗しました。");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "削除中にエラーが発生しました。");
      throw e;
    }
  };

  const handleAddGrowPhoto = async (payload: { plantId: string, storageKey: string, caption: string }) => {
    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Joint cultivator sharing
  const handleInviteCoopMember = async (id: string, email: string) => {
    try {
      const url = id.startsWith("sys-") ? `/api/systems/${id}/members` : `/api/plants/${id}/members`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        await syncDatabase();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "招待に失敗しました。メールアドレスが正しいかご確認ください。");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveCoopMember = async (id: string, userId: string) => {
    try {
      const url = id.startsWith("sys-") ? `/api/systems/${id}/members/${userId}` : `/api/plants/${id}/members/${userId}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        // If I kicked myself from co-cultivating, clear details view
        if (userId === user?.id) {
          setSelectedPlantDetails(null);
        }
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransferOwnership = async (id: string, newOwnerUserId: string) => {
    try {
      const url = id.startsWith("sys-") ? `/api/systems/${id}/transfer-owner` : `/api/plants/${id}/transfer-owner`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ newOwnerUserId })
      });
      if (res.ok) {
        await syncDatabase();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "所有者の変更に失敗しました。");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Schedule Proposal evaluation
  const handleApproveProposal = async (id: string, status: ProposalStatus, approvedDate?: string) => {
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status, proposedDate: approvedDate })
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompleteProposalTask = async (task: any) => {
    try {
      // 1. Update status to completed
      await handleApproveProposal(task.id, "completed");

      // 2. Resolve plant and system to see if it is soil
      const plant = plants.find((p) => p.id === task.plantId);
      const sys = plant ? systems.find((s) => s.id === plant.systemId) : null;
      const isSoil = sys && (sys.type === "Soil_Planter" || sys.type === "Backyard_Field");

      // 3. Automatically add a matching log entries
      if (task.type === "watering") {
        await handleAddGrowLog({
          plantId: task.plantId,
          ph: "",
          ec: "",
          waterTemp: "",
          note: `【タスク実施】 ${task.note}`,
          watered: true
        });
      } else if (task.type === "nutrient") {
        const inferredBrand = isSoil ? "マイガーデン / 固形ばらまき肥料 (置肥)" : "ハイポニカ液体肥料 (A液+B液)";
        await handleAddNutringLog({
          plantId: task.plantId,
          brand: inferredBrand,
          dilutionRate: isSoil ? "1" : "500",
          amountMl: isSoil ? "10" : "5",
          note: `【タスク実施】 ${task.note}`
        });
      } else {
        await handleAddGrowLog({
          plantId: task.plantId,
          ph: "",
          ec: "",
          waterTemp: "",
          note: `【タスク実施】 ${task.note}`,
          watered: false
        });
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // Chat with dynamic weather settings and automated params payload
  const handleSendMessageToAI = async (plantId: string, message: string) => {
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ plantId, message, userLocation })
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Force invoke Gemini proposals builder on a plant
  const handleTriggerAIScheduleCalculation = async (plantId: string) => {
    try {
      const res = await fetch("/api/ai/propose-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ plantId, userLocation })
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Settings updates
  const handleUpdateUserProfile = async (name: string) => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateClimateLocation = (loc: string) => {
    localStorage.setItem("hydro_location", loc);
    setUserLocation(loc);
  };

  // Return Sign-in Page if no user is validated
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-md">
            <Sprout className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">スマート菜園・プランター管理</h2>
          <p className="text-slate-500 text-xs">
            ベランダ家庭菜園、お庭の露地、室内水耕まで対応。成長ログ、共同栽培管理、そしてGemini AIによる散水・お世話自動スケジュール。
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
          <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-100 space-y-6">
            
            <div className="flex border-b border-slate-100 text-xs font-bold justify-around pb-3 mb-1">
              <button 
                onClick={() => setIsRegistering(false)}
                className={`pb-1 px-4 border-b-2 transition-all ${!isRegistering ? "border-emerald-600 text-slate-800" : "border-transparent text-slate-400"}`}
              >
                ログイン
              </button>
              <button 
                onClick={() => setIsRegistering(true)}
                className={`pb-1 px-4 border-b-2 transition-all ${isRegistering ? "border-emerald-600 text-slate-800" : "border-transparent text-slate-400"}`}
              >
                新規メンバー登録
              </button>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-1.5 leading-relaxed">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">
                  メールアドレス
                </label>
                <input 
                  type="email" 
                  value={loginEmail} 
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 text-base md:text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:bg-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {isRegistering && (
                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">
                    お名前（表示名）
                  </label>
                  <input 
                    type="text" 
                    value={loginName} 
                    onChange={(e) => setLoginName(e.target.value)}
                    required
                    placeholder="栽培太郎"
                    className="w-full px-4 py-2.5 text-base md:text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 font-sans focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              )}

              <button 
                type="submit"
                className="w-full py-2.5 px-4 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer text-center"
              >
                {isRegistering ? "栽培アカウントを作成" : "ログインする"}
              </button>
            </form>

            <div className="text-center text-[11px] text-slate-400 bg-slate-50 p-3 rounded-lg border border-dashed border-slate-100">
              <span className="font-bold text-slate-500">🧪 テストプレイ用のシードユーザー:</span><br />
              <code className="text-emerald-700 font-bold block mt-1">choco.rgi.duck@gmail.com</code>
              <span className="block mt-1">そのままボタンを押すだけでデモ環境へ入れます！</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loaded standard UI Layout
  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col font-sans text-slate-800">
      
      {/* Dynamic continuous loader overlay */}
      {loading && (
        <div className="fixed top-0 left-0 w-full h-1 bg-emerald-500 animate-pulse z-50"></div>
      )}

      {/* Main navigation Header bar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 bg-emerald-600 rounded-xl text-white block">
              <Sprout className="w-5 h-5" />
            </span>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-850">
              菜園＆スマート栽培管理
            </span>
          </div>

          {/* Navigation Tab controllers */}
          <nav className="hidden md:flex items-center gap-1 text-xs">
            <button 
              onClick={() => { setActiveTab("dashboard"); handleSelectDetailedPlant(null); }}
              className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <Activity className="w-4 h-4" /> ダッシュボード
            </button>
            <button 
              onClick={() => { setActiveTab("systems"); handleSelectDetailedPlant(null); }}
              className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${activeTab === 'systems' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <Sprout className="w-4 h-4" /> プランターと植物
            </button>
            <button 
              onClick={() => { setActiveTab("calendar"); handleSelectDetailedPlant(null); }}
              className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${activeTab === 'calendar' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <CalendarIcon className="w-4 h-4" /> カレンダー
            </button>
            <button 
              onClick={() => { setActiveTab("settings"); handleSelectDetailedPlant(null); }}
              className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${activeTab === 'settings' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <Settings className="w-4 h-4" /> 設定 / 気候地域
            </button>
          </nav>

          {/* User badge + Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-slate-800">{user.name}</div>
              <div className="text-[9.5px] text-slate-400 font-mono">{user.email}</div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 border border-slate-150 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile quick-bar navigation */}
        <div className="md:hidden border-t border-slate-50 flex items-center justify-around h-11 text-[11px] font-sans font-bold text-slate-500 bg-white shadow-xs">
          <button 
            onClick={() => { setActiveTab("dashboard"); handleSelectDetailedPlant(null); }}
            className={`flex-1 py-2 text-center flex items-center justify-center gap-1 ${activeTab === 'dashboard' ? 'text-emerald-700 bg-emerald-50/50' : 'hover:text-slate-800'}`}
          >
            ダッシュボード
          </button>
          <button 
            onClick={() => { setActiveTab("systems"); handleSelectDetailedPlant(null); }}
            className={`flex-1 py-2 text-center flex items-center justify-center gap-1 ${activeTab === 'systems' ? 'text-emerald-700 bg-emerald-50/50' : 'hover:text-slate-800'}`}
          >
            植物
          </button>
          <button 
            onClick={() => { setActiveTab("calendar"); handleSelectDetailedPlant(null); }}
            className={`flex-1 py-1.5 text-center flex items-center justify-center gap-1 ${activeTab === 'calendar' ? 'text-emerald-700 bg-emerald-50/50' : 'hover:text-slate-800'}`}
          >
            カレンダー
          </button>
          <button 
            onClick={() => { setActiveTab("settings"); handleSelectDetailedPlant(null); }}
            className={`flex-1 py-1.5 text-center flex items-center justify-center gap-1 ${activeTab === 'settings' ? 'text-emerald-700 bg-emerald-50/50' : 'hover:text-slate-800'}`}
          >
            気候・設定
          </button>
        </div>
      </header>

      {/* Main Body wrap layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
        
        {/* Render Views based on activated tabs pointer */}
        {activeTab === "dashboard" && (
          <DashboardView 
            user={user}
            systems={systems}
            plants={plants}
            proposals={proposals}
            userLocation={userLocation}
            token={token}
            predictions={predictions}
            lastCalcAt={lastCalcAt}
            loadingPredictions={loadingPredictions}
            predictionsError={predictionsError}
            onRefreshPredictions={fetchPredictions}
            onApproveProposal={handleApproveProposal}
            onCompleteProposalTask={handleCompleteProposalTask}
            onNavigateToTab={(tabName) => {
              setActiveTab(tabName);
            }}
            onSelectPlant={handleSelectDetailedPlant}
            onAddSystemClick={() => {
              setActiveTab("systems");
              // Wait for render cycle to trigger add system form slide in SystemPlantsView
            }}
          />
        )}

        {activeTab === "systems" && (
          <SystemPlantsView 
            user={user}
            systems={systems}
            plants={plants}
            selectedPlant={selectedPlantDetails}
            predictions={predictions}
            lastCalcAt={lastCalcAt}
            loadingPredictions={loadingPredictions}
            predictionsError={predictionsError}
            onRefreshPredictions={fetchPredictions}
            token={token}
            onSelectPlant={handleSelectDetailedPlant}
            onCreateSystem={handleCreateSystem}
            onUpdateSystem={handleUpdateSystem}
            onDeleteSystem={handleDeleteSystem}
            onCreatePlant={handleCreatePlant}
            onUpdatePlant={handleUpdatePlant}
            onDeletePlant={handleDeletePlant}
            onAddGrowLog={handleAddGrowLog}
            onAddNutrientLog={handleAddNutringLog}
            onUpdateNutrientLog={handleUpdateNutrientLog}
            onDeleteNutrientLog={handleDeleteNutrientLog}
            onUpdateGrowLog={handleUpdateGrowLog}
            onDeleteGrowLog={handleDeleteGrowLog}
            onAddPhoto={handleAddGrowPhoto}
            onInviteMember={handleInviteCoopMember}
            onRemoveMember={handleRemoveCoopMember}
            onTransferOwnership={handleTransferOwnership}
            onSendMessage={handleSendMessageToAI}
            onTriggerAIScheduleProposals={handleTriggerAIScheduleCalculation}
            onApproveProposal={handleApproveProposal}
          />
        )}

        {activeTab === "calendar" && (
          <CalendarView 
            proposals={proposals}
            onApproveProposal={handleApproveProposal}
            userToken={user.id}
            plants={plants}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView 
            user={user}
            userLocation={userLocation}
            onUpdateProfile={handleUpdateUserProfile}
            onUpdateLocation={handleUpdateClimateLocation}
          />
        )}

      </main>

      {/* Humble aesthetic footer */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-slate-450 font-mono text-[10px] text-slate-400">
        <div>Smart Garden & Cultivation Platform © 2026</div>
        <div className="mt-1">Powered by Gemini-3.5-Flash with Local Climate Adapter</div>
      </footer>

    </div>
  );
}
