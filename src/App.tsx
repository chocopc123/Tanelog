import React, { useState, useEffect, useLayoutEffect } from "react";
import { useScrollToTop } from "./hooks/useScrollToTop";
import { 
  User, System, Plant, ScheduleProposal, ProposalStatus, SystemType, PlantStage, HarvestPrediction, isSoilSystem 
} from "./types";
import { DashboardView } from "./components/DashboardView";
import { CalendarView } from "./components/CalendarView";
import { SystemPlantsView } from "./components/SystemPlantsView";
import { SettingsView } from "./components/SettingsView";
import { 
  Activity, Calendar as CalendarIcon, Droplets, Settings, LogOut, Sprout, ShieldAlert, CloudRain, CheckSquare, Sparkles 
} from "lucide-react";
import { auth, GoogleAuthProvider, signInWithPopup } from "./firebase";
import { TanelogLoader } from "./components/TanelogLoader";

const retryFetch = async (
  url: string,
  options?: RequestInit,
  retries = 3,
  delay = 1000
): Promise<Response> => {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Fetch to ${url} failed. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryFetch(url, options, retries - 1, delay * 1.5);
    }
    throw err;
  }
};

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
  const [authError, setAuthError] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [initialLoadingMessage, setInitialLoadingMessage] = useState("たねログを準備しています...");

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

  // Global weather advice cache state to prevent layout shift on quick tab switching
  const [weatherAdvice, setWeatherAdvice] = useState<string | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Remounting keys for each tab to reset state on tab re-click
  const [dashboardKey, setDashboardKey] = useState(0);
  const [systemsKey, setSystemsKey] = useState(0);
  const [calendarKey, setCalendarKey] = useState(0);
  const [settingsKey, setSettingsKey] = useState(0);

  // Scroll to top on page (tab) or selected plant change to improve UX on transitioning
  useScrollToTop([selectedPlantDetails, activeTab]);

  const handleTabClick = (tabName: string) => {
    setActiveTab(tabName);
    handleSelectDetailedPlant(null);

    if (tabName === "dashboard") setDashboardKey(prev => prev + 1);
    if (tabName === "systems") setSystemsKey(prev => prev + 1);
    if (tabName === "calendar") setCalendarKey(prev => prev + 1);
    if (tabName === "settings") setSettingsKey(prev => prev + 1);

    // Scroll to the absolute top smoothly
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    const containers = [
      document.querySelector("main"),
      document.getElementById("main-container"),
      document.getElementById("app-scroll-container"),
    ];
    containers.forEach((container) => {
      if (container) {
        container.scrollTop = 0;
      }
    });
  };

  // Load weather advice once globally, or when location/token changes, preventing re-fetching on tab toggles
  useEffect(() => {
    if (!user) return;
    let active = true;
    const fetchWeatherAdvice = async () => {
      setLoadingWeather(true);
      setWeatherError(null);
      try {
        const headers: { [key: string]: string } = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await retryFetch(`/api/weather-advice?location=${encodeURIComponent(userLocation || "長野県長野市")}`, {
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
        console.warn("Failed to fetch climate/weather advice:", err);
      } finally {
        if (active) setLoadingWeather(false);
      }
    };

    fetchWeatherAdvice();
    return () => {
      active = false;
    };
  }, [userLocation, token, user]);

  // Loading Feedback
  const [loading, setLoading] = useState(false);

  // 初回起動時、またはトークン切り替え時に実行される統合ロード関数
  const loadUserDataAndSync = async (userToken: string, preloadedUser?: User, isNewLogin: boolean = false) => {
    setIsInitialLoading(true);
    if (!isNewLogin) {
      setInitialLoadingMessage("アカウント情報を読み込んでいます...");
    }

    try {
      const currentUser = preloadedUser || await fetchCurrentUser(userToken);

      if (currentUser) {
        setUser(currentUser);
        
        // 栽培データ同期
        await syncDatabase(false, userToken);
        
        // AI予測データ同期
        await fetchPredictions(false, userToken);
      } else {
        console.warn("User data not found or session expired.");
        handleLogout();
      }
    } catch (e) {
      console.warn("Failed to load user session or sync data:", e);
      handleLogout();
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Synchronous initial fetch
  useEffect(() => {
    if (token) {
      loadUserDataAndSync(token);
    } else {
      setIsInitialLoading(false);
    }
  }, []);

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

  const fetchPredictions = async (force: boolean = false, overrideToken?: string) => {
    const activeToken = overrideToken || token;
    if (!activeToken) return;
    setLoadingPredictions(true);
    try {
      const res = await retryFetch(`/api/plants/harvest-predictions?force=${force}`, {
        headers: { "Authorization": `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
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
        } else {
          console.warn("Harvest predictions API response was not JSON (server may be restarting/rebuilding)");
        }
      }
    } catch (err) {
      console.warn("Failed to fetch harvest predictions:", err);
    } finally {
      setLoadingPredictions(false);
    }
  };

  const fetchCurrentUser = async (overrideToken?: string) => {
    const activeToken = overrideToken || token;
    if (!activeToken) return null;
    try {
      const res = await retryFetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setUser(data.user);
          return data.user;
        } else {
          console.warn("Auth check: non-JSON response from server");
        }
      } else {
        // Clear stale credentials safely
        handleLogout();
      }
    } catch (e) {
      console.warn("Failed to load user profile", e);
    }
    return null;
  };

  const syncDatabase = async (silent = false, overrideToken?: string) => {
    const activeToken = overrideToken || token;
    if (!activeToken) return;
    if (!silent) setLoading(true);
    try {
      const headerAuth = { "Authorization": `Bearer ${activeToken}` };

      const [resSys, resPlants, resProps] = await Promise.all([
        retryFetch("/api/systems", { headers: headerAuth }),
        retryFetch("/api/plants", { headers: headerAuth }),
        retryFetch("/api/proposals", { headers: headerAuth })
      ]);

      if (resSys.ok && resPlants.ok && resProps.ok) {
        const ctSys = resSys.headers.get("content-type");
        const ctPlants = resPlants.headers.get("content-type");
        const ctProps = resProps.headers.get("content-type");

        if (
          ctSys && ctSys.includes("application/json") &&
          ctPlants && ctPlants.includes("application/json") &&
          ctProps && ctProps.includes("application/json")
        ) {
          const sysData = await resSys.json();
          const plantData = await resPlants.json();
          const propsData = await resProps.json();

          setSystems(sysData);
          setPlants(plantData);
          setProposals(propsData);

          // Auto re-hydrate detailed plant if it is currently selected
          if (selectedPlantDetails) {
            const freshDetailsRes = await retryFetch(`/api/plants/${selectedPlantDetails.id}`, { headers: headerAuth });
            if (freshDetailsRes.ok) {
              const ctDetails = freshDetailsRes.headers.get("content-type");
              if (ctDetails && ctDetails.includes("application/json")) {
                const fd = await freshDetailsRes.json();
                setSelectedPlantDetails(fd);
              }
            }
          }
        } else {
          console.warn("Database sync: non-JSON responses received (server may be restarting/rebuilding)");
        }
      }
    } catch (e) {
      console.warn("Database status synchronization failed:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Auth Operations
  const handleGoogleLogin = async () => {
    setAuthError("");
    setIsInitialLoading(true);
    setInitialLoadingMessage("Googleアカウントと接続しています...");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      
      const idToken = await result.user.getIdToken();
      const ep = "/api/auth/login";
      
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          email: result.user.email,
          name: result.user.displayName || result.user.email?.split("@")[0] || ""
        })
      });

      const data = await res.json();
      if (res.ok) {
        const cleanTok = String(data.token || "").replace(/[^\x21-\x7E]/g, "");
        localStorage.setItem("hydro_token", cleanTok);
        setToken(cleanTok);
        // ここから全栽培データのロードを開始する（loadUserDataAndSync がロード完了時に setIsInitialLoading(false) にする）
        await loadUserDataAndSync(cleanTok, data.user, true);
      } else {
        setAuthError(data.error || "Google認証後に予期せぬエラーが発生しました");
        setIsInitialLoading(false);
      }
    } catch (err: any) {
      setIsInitialLoading(false);
      if (err.code !== "auth/cancelled-popup-request" && err.code !== "auth/popup-closed-by-user") {
        console.error("Google Auth error:", err);
      }
      if (err.code === "auth/popup-blocked") {
        setAuthError("ポップアップがブロックされました。ポップアップ許可を確認してください。");
      } else if (err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
        setAuthError(""); // Ignore cancellation quietly
      } else if (err.code === "auth/unauthorized-domain") {
        setAuthError(`このドメイン (${window.location.hostname}) が Firebase Authentication の承認済みドメインに登録されていません。Firebase コンソールの [Authentication] -> [設定] -> [承認済みドメイン] にこのドメインを追加してください。`);
      } else {
        setAuthError(`Google認証への接続中にエラーが発生しました。エラーコード: ${err.code || "unknown"} (${err.message || err})`);
      }
    }
  };

  const handleEmailLogin = async (emailToSubmit: string) => {
    const trimmed = (emailToSubmit || "").trim();
    if (!trimmed || !trimmed.includes("@")) {
      setAuthError("有効なメールアドレスを入力してください。");
      return;
    }
    setAuthError("");
    setIsInitialLoading(true);
    setInitialLoadingMessage("アカウントにログインしています...");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed })
      });

      const data = await res.json();
      if (res.ok) {
        const cleanTok = String(data.token || "").replace(/[^\x21-\x7E]/g, "");
        localStorage.setItem("hydro_token", cleanTok);
        setToken(cleanTok);
        await loadUserDataAndSync(cleanTok, data.user, true);
      } else {
        setAuthError(data.error || "ログインに失敗しました。");
        setIsInitialLoading(false);
      }
    } catch (err: any) {
      setIsInitialLoading(false);
      console.error("Email login error:", err);
      setAuthError(`ログイン接続中にエラーが発生しました: ${err.message || err}`);
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
  const handleCreatePlant = async (payload: { systemId: string, name: string, variety: string, stage: PlantStage, sowingDate: string, expectedHarvestDate: string, fertilizerBrand?: string, fertilizerAmountMl?: string, fertilizerDilutionRate?: string }) => {
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
  const handleAddGrowLog = async (payload: { plantId: string, ph: string, ec: string, waterTemp: string, note: string, watered?: boolean, imageUrl?: string, imageUrls?: string[], appliedFertilizer?: boolean, fertilizerBrand?: string, fertilizerAmountMl?: string, fertilizerDilutionRate?: string }) => {
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
  const handleApproveProposal = async (id: string, status: ProposalStatus, approvedDate?: string, type?: string, note?: string) => {
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status, proposedDate: approvedDate, type, note })
      });
      if (res.ok) {
        await syncDatabase();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateProposal = async (plantId: string, type: string, proposedDate: string, note: string) => {
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ plantId, type, proposedDate, note })
      });
      if (res.ok) {
        await syncDatabase();
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "スケジュールの新規作成に失敗しました。");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "作成中にエラーが発生しました。");
      throw e;
    }
  };

  const handleCompleteProposalTask = async (task: any) => {
    try {
      // 1. Update status to completed
      await handleApproveProposal(task.id, "completed");

      // 2. Resolve plant and system to see if it is soil
      const plant = plants.find((p) => p.id === task.plantId);
      const sys = plant ? systems.find((s) => s.id === plant.systemId) : null;
      const isSoil = sys && isSoilSystem(sys.type);

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
  const handleUpdateUserProfile = async (name: string, showPhEc?: boolean) => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name, showPhEc })
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

  // Return early with custom loader if initial sync in progress
  if (isInitialLoading) {
    return <TanelogLoader message={initialLoadingMessage} />;
  }

  // Return Sign-in Page if no user is validated
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
          <div className="mx-auto w-12 h-12 flex items-center justify-center">
            <img src="/tanelog.png" alt="たねログ" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">たねログ</h2>
          <p className="text-slate-500 text-xs">
            ベランダ家庭菜園、お庭用のプランターや、室内水耕用プランターまで対応。<br/>日々の栽培状況を記録し、お世話スケジュールを整理・管理できます。
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-100 space-y-6 text-center">

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-1.5 leading-relaxed text-left">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-4">
              <button 
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3.5 px-4 font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-center flex items-center justify-center gap-3 border border-transparent"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.6c-.28 1.5-1.12 2.76-2.38 3.6v3h3.84c2.25-2.07 3.68-5.12 3.68-8.43z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.84-3c-1.08.72-2.45 1.16-4.09 1.16-3.15 0-5.81-2.13-6.76-5.01H1.28v3.1c2 3.97 6.11 6.66 10.72 6.66z"/>
                  <path fill="#FBBC05" d="M5.24 14.24a7.15 7.15 0 0 1 0-4.48V6.66H1.28a11.96 11.96 0 0 0 0 10.68l3.96-3.1z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.39 0 3.28 2.69 1.28 6.66L5.24 9.76c.95-2.88 3.61-5.01 6.76-5.01z"/>
                </svg>
                Googleアカウントでサインイン
              </button>
              
              <p className="text-[11px] text-slate-400 leading-relaxed">
                本サービスは安全かつ迅速なログインを実現するため、Google認証を採用しています。
              </p>
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
            <div className="w-8 h-8 flex items-center justify-center">
              <img src="/tanelog.png" alt="たねログ" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-850">
              たねログ
            </span>
          </div>

          {/* Navigation Tab controllers */}
          <nav className="hidden md:flex items-center gap-1 text-xs">
            <button 
              onClick={() => handleTabClick("dashboard")}
              className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <Activity className="w-4 h-4" /> ダッシュボード
            </button>
            <button 
              onClick={() => handleTabClick("systems")}
              className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${activeTab === 'systems' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <Sprout className="w-4 h-4" /> プランターと植物
            </button>
            <button 
              onClick={() => handleTabClick("calendar")}
              className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${activeTab === 'calendar' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <CalendarIcon className="w-4 h-4" /> カレンダー
            </button>
            <button 
              onClick={() => handleTabClick("settings")}
              className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${activeTab === 'settings' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <Settings className="w-4 h-4" /> 設定
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
            onClick={() => handleTabClick("dashboard")}
            className={`flex-1 py-2 text-center flex items-center justify-center gap-1 ${activeTab === 'dashboard' ? 'text-emerald-700 bg-emerald-50/50' : 'hover:text-slate-805'}`}
          >
            ダッシュボード
          </button>
          <button 
            onClick={() => handleTabClick("systems")}
            className={`flex-1 py-2 text-center flex items-center justify-center gap-1 ${activeTab === 'systems' ? 'text-emerald-700 bg-emerald-50/50' : 'hover:text-slate-805'}`}
          >
            植物
          </button>
          <button 
            onClick={() => handleTabClick("calendar")}
            className={`flex-1 py-1.5 text-center flex items-center justify-center gap-1 ${activeTab === 'calendar' ? 'text-emerald-700 bg-emerald-50/50' : 'hover:text-slate-805'}`}
          >
            カレンダー
          </button>
          <button 
            onClick={() => handleTabClick("settings")}
            className={`flex-1 py-1.5 text-center flex items-center justify-center gap-1 ${activeTab === 'settings' ? 'text-emerald-700 bg-emerald-50/50' : 'hover:text-slate-805'}`}
          >
            設定
          </button>
        </div>
      </header>

      {/* Main Body wrap layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
        
        {/* Render Views based on activated tabs pointer */}
        {activeTab === "dashboard" && (
          <DashboardView 
            key={dashboardKey}
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
            weatherAdvice={weatherAdvice}
            loadingWeather={loadingWeather}
            weatherError={weatherError}
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
            key={systemsKey}
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
            key={calendarKey}
            proposals={proposals}
            onApproveProposal={handleApproveProposal}
            onCreateProposal={handleCreateProposal}
            userToken={user.id}
            plants={plants}
            systems={systems}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView 
            key={settingsKey}
            user={user}
            userLocation={userLocation}
            onUpdateProfile={handleUpdateUserProfile}
            onUpdateLocation={handleUpdateClimateLocation}
          />
        )}

      </main>

      {/* Humble aesthetic footer */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-slate-450 font-mono text-[10px] text-slate-400">
        <div>たねログ (Tanelog) 2026 by choco_duck</div>
      </footer>

    </div>
  );
}
