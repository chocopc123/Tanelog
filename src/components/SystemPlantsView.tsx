import React, { useState, useEffect } from "react";
import { useScrollToTop } from "../hooks/useScrollToTop";
import { ActiveArchivedTabs } from "./ActiveArchivedTabs";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, System, Plant, GrowLog, PlantPhoto, NutrientLog, ChatMessage, MemberRole, SystemType, PlantStage, HarvestPrediction 
} from "../types";
import { 
  Plus, Droplets, Trash2, Edit3, MessageSquare, ArrowLeft, Calendar, 
  Sparkles, Camera, Users, Clipboard, PlusCircle, CheckCircle, 
  AlertTriangle, FlaskConical, Thermometer, ChevronRight, CornerDownRight, X, Clock, Upload, RefreshCcw, Sprout, Settings
} from "lucide-react";

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

interface SystemPlantsViewProps {
  user: User;
  systems: System[];
  plants: any[]; // Hydrated plants
  selectedPlant: any | null; // Detailed plant state hydrated from backend
  predictions?: HarvestPrediction[];
  lastCalcAt?: string;
  loadingPredictions?: boolean;
  predictionsError?: string | null;
  onRefreshPredictions?: (force: boolean) => Promise<void>;
  token?: string | null;
  onSelectPlant: (id: string | null) => void;
  onCreateSystem: (name: string, type: SystemType, description: string) => void;
  onUpdateSystem: (id: string, payload: any) => Promise<void>;
  onDeleteSystem: (id: string) => void;
  onCreatePlant: (payload: { systemId: string, name: string, variety: string, stage: PlantStage, sowingDate: string, expectedHarvestDate: string }) => void;
  onUpdatePlant: (id: string, payload: any) => void;
  onDeletePlant: (id: string) => void;
  onAddGrowLog: (payload: { plantId: string, ph: string, ec: string, waterTemp: string, note: string, watered?: boolean, imageUrl?: string, imageUrls?: string[] }) => void;
  onAddNutrientLog: (payload: { plantId: string, brand: string, dilutionRate: string, amountMl: string, note: string }) => void;
  onUpdateNutrientLog: (id: string, payload: any) => Promise<void>;
  onDeleteNutrientLog: (id: string) => Promise<void>;
  onUpdateGrowLog: (id: string, payload: any) => Promise<void>;
  onDeleteGrowLog: (id: string) => Promise<void>;
  onAddPhoto: (payload: { plantId: string, storageKey: string, caption: string }) => void;
  onInviteMember: (plantId: string, email: string) => void;
  onRemoveMember: (plantId: string, userId: string) => void;
  onTransferOwnership: (plantId: string, newOwnerUserId: string) => void;
  onSendMessage: (plantId: string, message: string) => Promise<void>;
  onTriggerAIScheduleProposals: (plantId: string) => Promise<void>;
  onApproveProposal: (id: string, status: any, approvedDate?: string) => Promise<void>;
}

export const SystemPlantsView: React.FC<SystemPlantsViewProps> = ({
  user,
  systems,
  plants,
  selectedPlant,
  predictions = [],
  lastCalcAt = "",
  loadingPredictions = false,
  predictionsError,
  onRefreshPredictions,
  token,
  onSelectPlant,
  onCreateSystem,
  onUpdateSystem,
  onDeleteSystem,
  onCreatePlant,
  onUpdatePlant,
  onDeletePlant,
  onAddGrowLog,
  onAddNutrientLog,
  onUpdateNutrientLog,
  onDeleteNutrientLog,
  onUpdateGrowLog,
  onDeleteGrowLog,
  onAddPhoto,
  onInviteMember,
  onRemoveMember,
  onTransferOwnership,
  onSendMessage,
  onTriggerAIScheduleProposals,
  onApproveProposal
}) => {
  // Compute global climate garden parameters
  const currentSys = selectedPlant ? systems.find((s) => s.id === selectedPlant.systemId) : null;
  const isSoil = currentSys && (currentSys.type === "Soil_Planter" || currentSys.type === "Backyard_Field");

  // Navigation inside this panel
  const [showAddSys, setShowAddSys] = useState(false);
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [sysIdForNewPlant, setSysIdForNewPlant] = useState("");

  // Create System form state
  const [newSysName, setNewSysName] = useState("");
  const [newSysType, setNewSysType] = useState<SystemType>("DWC");
  const [newSysDesc, setNewSysDesc] = useState("");

  // Create Plant form state
  const [newPlantName, setNewPlantName] = useState("");
  const [newPlantVariety, setNewPlantVariety] = useState("");
  const [newPlantStage, setNewPlantStage] = useState<PlantStage>("vegetative");
  const [newPlantSowing, setNewPlantSowing] = useState("2026-06-03");
  const [newPlantHarvest, setNewPlantHarvest] = useState("2026-07-03");

  // Inside single plant details tabs
  const [activeTab, setActiveTab] = useState<"logs" | "nutrients" | "ai" | "photos" | "settings">("logs");

  // Log Inputs
  const [logPh, setLogPh] = useState("");
  const [logEc, setLogEc] = useState("");
  const [logTemp, setLogTemp] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logWatered, setLogWatered] = useState(true);
  const [logPhotoBase64s, setLogPhotoBase64s] = useState<string[]>([]);
  
  // Automatic temperature fetching state
  const [fetchingTemp, setFetchingTemp] = useState(false);

  const handleFetchCurrentTemp = async () => {
    setFetchingTemp(true);
    try {
      const loc = localStorage.getItem("hydro_location") || "長野県長野市";
      const url = `/api/weather-current?location=${encodeURIComponent(loc)}`;
      const res = await retryFetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogTemp(String(data.temp));
        triggerToast(`🌤 ${loc}のリアルタイム気温（${data.temp}℃）を自動取得しました！`);
      } else {
        triggerToast("⚠️ 気温の自動取得API呼び出しに失敗しました。");
      }
    } catch (e) {
      console.error("Failed to fetch climate temperature automatically", e);
      triggerToast("⚠️ 気温の自動取得中にインターネット通信エラーが発生しました。");
    } finally {
      setFetchingTemp(false);
    }
  };

  // Nutrient Inputs
  const [nutBrand, setNutBrand] = useState("ハイポニカ液体肥料 (A液+B液)");
  const [nutDilution, setNutDilution] = useState("500");
  const [nutAmount, setNutAmount] = useState("5");
  const [nutNote, setNutNote] = useState("");

  // AI Chat prompt
  const [aiPrompt, setAiPrompt] = useState("");
  const [sendingAi, setSendingAi] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Photo uploads
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoBase64, setPhotoBase64] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Collaboration Invitation Input
  const [inviteEmail, setInviteEmail] = useState("");

  // System-level collaboration states
  const [activeSystemMembersId, setActiveSystemMembersId] = useState<string | null>(null);
  const [activeSystemSettingsId, setActiveSystemSettingsId] = useState<string | null>(null);
  const [sysSettingsTab, setSysSettingsTab] = useState<"coop" | "management">("coop");
  const [sysInviteEmails, setSysInviteEmails] = useState<{ [systemId: string]: string }>({});

  // Tab for Active / Archived
  const [viewArchived, setViewArchived] = useState(false);

  // ページ遷移系アクションのスクロールリセットカスタムフック
  useScrollToTop([
    selectedPlant?.id,
    activeSystemSettingsId,
    showAddSys,
    showAddPlant,
  ]);

  // Custom confirmation modal state
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ run: () => void } | null>(null);

  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction({ run: onConfirm });
    setShowConfirm(true);
  };

  // Editing logs states
  const [editingNutrientLogId, setEditingNutrientLogId] = useState<string | null>(null);
  const [editNutrientBrand, setEditNutrientBrand] = useState("");
  const [editNutrientDilution, setEditNutrientDilution] = useState("500");
  const [editNutrientAmount, setEditNutrientAmount] = useState("5");
  const [editNutrientNote, setEditNutrientNote] = useState("");
  const [editNutrientAppliedAt, setEditNutrientAppliedAt] = useState("");

  const [editingGrowLogId, setEditingGrowLogId] = useState<string | null>(null);
  const [editGrowPh, setEditGrowPh] = useState("");
  const [editGrowEc, setEditGrowEc] = useState("");
  const [editGrowWaterTemp, setEditGrowWaterTemp] = useState("");
  const [editGrowNote, setEditGrowNote] = useState("");
  const [editGrowLoggedAt, setEditGrowLoggedAt] = useState("");
  const [editGrowWatered, setEditGrowWatered] = useState(true);
  const [editGrowPhotoBase64s, setEditGrowPhotoBase64s] = useState<string[]>([]);

  // Photo dynamic modal state for album
  const [selectedPhotoLog, setSelectedPhotoLog] = useState<any | null>(null);
  const [activePhotoSubIndex, setActivePhotoSubIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<number>(0);

  const handleNextPhoto = () => {
    if (!selectedPlant || !selectedPhotoLog) return;
    const list = (selectedPlant.growLogs || []).filter((log: any) => log.imageUrl || (log.imageUrls && log.imageUrls.length > 0));
    if (list.length === 0) return;

    const currentImages = selectedPhotoLog.imageUrls && selectedPhotoLog.imageUrls.length > 0
      ? selectedPhotoLog.imageUrls
      : (selectedPhotoLog.imageUrl ? [selectedPhotoLog.imageUrl] : []);

    if (activePhotoSubIndex < currentImages.length - 1) {
      // Move to next image inside the same grow log
      setSwipeDirection(1);
      setActivePhotoSubIndex(prev => prev + 1);
    } else {
      // Move to the next grow log's first image
      const currentIndex = list.findIndex((log: any) => log.id === selectedPhotoLog.id);
      if (currentIndex === -1) return;
      const nextIndex = (currentIndex + 1) % list.length;
      setSwipeDirection(1);
      setSelectedPhotoLog(list[nextIndex]);
      setActivePhotoSubIndex(0);
    }
  };

  const handlePrevPhoto = () => {
    if (!selectedPlant || !selectedPhotoLog) return;
    const list = (selectedPlant.growLogs || []).filter((log: any) => log.imageUrl || (log.imageUrls && log.imageUrls.length > 0));
    if (list.length === 0) return;

    if (activePhotoSubIndex > 0) {
      // Move to previous image inside the same grow log
      setSwipeDirection(-1);
      setActivePhotoSubIndex(prev => prev - 1);
    } else {
      // Move to the previous grow log's last image
      const currentIndex = list.findIndex((log: any) => log.id === selectedPhotoLog.id);
      if (currentIndex === -1) return;
      const prevIndex = (currentIndex - 1 + list.length) % list.length;
      const prevLog = list[prevIndex];
      const prevImages = prevLog.imageUrls && prevLog.imageUrls.length > 0
        ? prevLog.imageUrls
        : (prevLog.imageUrl ? [prevLog.imageUrl] : []);

      setSwipeDirection(-1);
      setSelectedPhotoLog(prevLog);
      setActivePhotoSubIndex(prevImages.length > 0 ? prevImages.length - 1 : 0);
    }
  };

  // Prevent background scrolling when modals are open
  useEffect(() => {
    if (editingNutrientLogId || editingGrowLogId || selectedPhotoLog || showConfirm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [editingNutrientLogId, editingGrowLogId, selectedPhotoLog, showConfirm]);

  const startEditNutrientLog = (log: any) => {
    setEditingNutrientLogId(log.id);
    setEditNutrientBrand(log.brand || "");
    setEditNutrientDilution(String(log.dilutionRate || 500));
    setEditNutrientAmount(String(log.amountMl || 5));
    setEditNutrientNote(log.note || "");
    setEditNutrientAppliedAt(log.appliedAt ? log.appliedAt.split("T")[0] : new Date().toISOString().split("T")[0]);
  };

  const handleUpdateNutrientLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNutrientLogId) return;
    try {
      await onUpdateNutrientLog(editingNutrientLogId, {
        brand: editNutrientBrand,
        dilutionRate: parseInt(editNutrientDilution) || 500,
        amountMl: parseInt(editNutrientAmount) || 5,
        note: editNutrientNote,
        appliedAt: editNutrientAppliedAt ? new Date(editNutrientAppliedAt).toISOString() : new Date().toISOString()
      });
      setEditingNutrientLogId(null);
      triggerToast("施肥散布履歴を更新しました！");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNutrientLogClick = (id: string) => {
    requestConfirm(
      "施肥散布履歴の削除",
      "本当にこの施肥・散布履歴を削除しますか？ （この操作は取り消せません）",
      async () => {
        try {
          await onDeleteNutrientLog(id);
          triggerToast("施肥散布履歴を削除しました。");
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const startEditGrowLog = (log: any) => {
    setEditingGrowLogId(log.id);
    setEditGrowPh(log.ph !== null && log.ph !== undefined ? String(log.ph) : "");
    setEditGrowEc(log.ec !== null && log.ec !== undefined ? String(log.ec) : "");
    setEditGrowWaterTemp(log.waterTemp !== null && log.waterTemp !== undefined ? String(log.waterTemp) : "");
    setEditGrowNote(log.note || "");
    setEditGrowLoggedAt(log.loggedAt ? log.loggedAt.split("T")[0] : new Date().toISOString().split("T")[0]);
    setEditGrowWatered(log.watered !== false);
    setEditGrowPhotoBase64s(log.imageUrls && log.imageUrls.length > 0 ? log.imageUrls : (log.imageUrl ? [log.imageUrl] : []));
  };

  const handleUpdateGrowLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrowLogId) return;
    try {
      await onUpdateGrowLog(editingGrowLogId, {
        ph: editGrowPh,
        ec: editGrowEc,
        waterTemp: editGrowWaterTemp,
        note: editGrowNote,
        loggedAt: editGrowLoggedAt ? new Date(editGrowLoggedAt).toISOString() : new Date().toISOString(),
        watered: editGrowWatered,
        imageUrl: editGrowPhotoBase64s.length > 0 ? editGrowPhotoBase64s[0] : undefined,
        imageUrls: editGrowPhotoBase64s.length > 0 ? editGrowPhotoBase64s : undefined
      });
      setEditingGrowLogId(null);
      setEditGrowPhotoBase64s([]);
      triggerToast("測定履歴を更新しました！");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGrowLogClick = (id: string) => {
    requestConfirm(
      "測定履歴の削除",
      "本当にこの測定履歴を削除しますか？ （この操作は取り消せません）",
      async () => {
        try {
          await onDeleteGrowLog(id);
          triggerToast("測定履歴を削除しました。");
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  // Helper trigger action message toast
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  const handleCompleteTask = async (task: any) => {
    try {
      await onApproveProposal(task.id, "completed");

      if (task.type === "watering") {
        await onAddGrowLog({
          plantId: selectedPlant.id,
          ph: "",
          ec: "",
          waterTemp: "",
          note: `【タスク実施】 ${task.note}`,
          watered: true
        });
      } else if (task.type === "nutrient") {
        let inferredBrand = isSoil ? "マイガーデン / 固形ばらまき肥料 (置肥)" : "ハイポニカ液体肥料 (A液+B液)";
        await onAddNutrientLog({
          plantId: selectedPlant.id,
          brand: inferredBrand,
          dilutionRate: isSoil ? "1" : "500",
          amountMl: isSoil ? "10" : "5",
          note: `【タスク実施】 ${task.note}`
        });
      } else {
        await onAddGrowLog({
          plantId: selectedPlant.id,
          ph: "",
          ec: "",
          waterTemp: "",
          note: `【タスク実施】 ${task.note}`,
          watered: false
        });
      }

      triggerToast(`タスク「${task.note.substring(0, 15)}...」を達成完了とし栽培日記に自動登録しました！`);
    } catch (err) {
      console.error(err);
      triggerToast("タスクの完了処理中にエラーが発生しました。");
    }
  };

  const handleCreateSystem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSysName) return;
    onCreateSystem(newSysName, newSysType, newSysDesc);
    setNewSysName("");
    setNewSysDesc("");
    setShowAddSys(false);
    triggerToast("新しいプランターを登録しました！🌱");
  };

  const handleCreatePlant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlantName || !sysIdForNewPlant) return;
    onCreatePlant({
      systemId: sysIdForNewPlant,
      name: newPlantName,
      variety: newPlantVariety,
      stage: newPlantStage,
      sowingDate: newPlantSowing,
      expectedHarvestDate: newPlantHarvest
    });
    setNewPlantName("");
    setNewPlantVariety("");
    setShowAddPlant(false);
    triggerToast("プラント栽培プロファイルを作製しました 🌱");
  };

  const handleAddLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant) return;
    onAddGrowLog({
      plantId: selectedPlant.id,
      ph: logPh,
      ec: logEc,
      waterTemp: logTemp,
      note: logNote,
      watered: logWatered,
      imageUrl: logPhotoBase64s.length > 0 ? logPhotoBase64s[0] : undefined,
      imageUrls: logPhotoBase64s.length > 0 ? logPhotoBase64s : undefined
    });
    setLogPh("");
    setLogEc("");
    setLogTemp("");
    setLogNote("");
    setLogWatered(true);
    setLogPhotoBase64s([]);
    triggerToast("水質・収穫期ロギング記録を格納しました。");
  };

  const handleAddNutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant) return;
    onAddNutrientLog({
      plantId: selectedPlant.id,
      brand: nutBrand,
      dilutionRate: nutDilution,
      amountMl: nutAmount,
      note: nutNote
    });
    setNutNote("");
    triggerToast("施肥履歴を追加しました 🧪");
  };

  // Base64 file reader helper
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPhotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant || !photoBase64) return;
    onAddPhoto({
      plantId: selectedPlant.id,
      storageKey: photoBase64,
      caption: photoCaption || "栽培成長スナップ"
    });
    setPhotoBase64("");
    setPhotoCaption("");
    triggerToast("栽培状況写真アルバムへ格納しました📷");
  };

  // Injects simulated beautiful vector mock snap based on variety
  const handleInjectSimulatedSnap = () => {
    if (!selectedPlant) return;
    let plantColor = "%2310b981"; // green
    if (selectedPlant.name.includes("トマト")) plantColor = "%23f43f5e"; // rose/red
    else if (selectedPlant.name.includes("バジル")) plantColor = "%23059669"; // jade

    const base64Str = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'><rect width='600' height='400' fill='%23fafaf9'/><circle cx='300' cy='220' r='80' fill='${plantColor}' opacity='0.85'/><path d='M300,100 Q320,130 300,160 Q280,130 300,100 Z' fill='%2315803d'/><text x='50%25' y='65%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='15' fill='%2344403c'>📸 AIカメラ栽培シミュレーション画像</text></svg>`;
    setPhotoBase64(base64Str);
    setPhotoCaption(`${selectedPlant.name} の生育シミュレーションスナップ`);
  };

  const handleAddInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant || !inviteEmail) return;
    onInviteMember(selectedPlant.id, inviteEmail);
    setInviteEmail("");
    triggerToast("共同栽培招待を送信/反映しました 👥");
  };

  const handleGoToLog = (logId: string) => {
    setActiveTab("logs");
    
    // スクロール先のDOM要素が描画されるのを少し待つ
    setTimeout(() => {
      const desktopEl = document.getElementById(`grow-log-row-${logId}`);
      const mobileEl = document.getElementById(`grow-log-card-${logId}`);
      // デスクトップ幅かどうかを判定してターゲットを決定
      const el = (window.innerWidth >= 768 ? desktopEl : mobileEl) || desktopEl || mobileEl;
      
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // 一時的に目立たせる背景＆ボーダーアニメーションを付与
        el.classList.add("bg-amber-100/50", "ring-2", "ring-amber-500/30", "transition-all", "duration-500");
        setTimeout(() => {
          el.classList.remove("bg-amber-100/50", "ring-2", "ring-amber-500/30");
        }, 2000);
      }
    }, 150);
  };

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant || !aiPrompt) return;
    const msg = aiPrompt;
    setAiPrompt("");
    setSendingAi(true);
    await onSendMessage(selectedPlant.id, msg);
    setSendingAi(false);
  };

  const handleTriggerAISchedule = async () => {
    if (!selectedPlant) return;
    setGeneratingSchedule(true);
    await onTriggerAIScheduleProposals(selectedPlant.id);
    setGeneratingSchedule(false);
    triggerToast("Gemini AIが現在の状態に沿ったスケジュール提案をカレンダーに追加しました✨");
  };

  return (
    <div id="systems-plants-container">
      
      {/* Dynamic Action Toasts feedback */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white font-bold p-4 rounded-xl shadow-xl flex items-center gap-2 max-w-sm animate-bounce text-xs font-sans">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* NO SELECTED PLANT DETAILED PROFILE (SHOW SYSTEMS & PLANTS GRID LISTING) */}
      {activeSystemSettingsId ? (
        (() => {
          const sys = systems.find(s => s.id === activeSystemSettingsId);
          if (!sys) {
            setTimeout(() => setActiveSystemSettingsId(null), 0);
            return null;
          }

          const isOwner = sys.currentUserRole === "owner" || !sys.members?.some((m: any) => m.userId === user?.id && m.role === "owner");
          
          return (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Header Box / Return */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setActiveSystemSettingsId(null)}
                    className="p-2 hover:bg-slate-50 border border-slate-150 rounded-xl text-slate-600 cursor-pointer transition-colors flex items-center justify-center shrink-0"
                    title="プランター一覧に戻る"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="text-left">
                    <div className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">
                      プランター設定・管理
                    </div>
                    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight mt-0.5 flex items-center gap-1.5">
                      ⚙️ {sys.name} の設定
                    </h2>
                  </div>
                </div>
              </div>

              {/* プランター設定のタブナビゲーション */}
              <div className="flex border-b border-slate-200 gap-1 overflow-x-auto scrollbar-none font-sans">
                <button
                  type="button"
                  id="sys-tab-coop"
                  onClick={() => setSysSettingsTab("coop")}
                  className={`px-5 py-3 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                    sysSettingsTab === "coop"
                      ? "border-emerald-600 text-emerald-800 font-extrabold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>共同栽培・共有設定</span>
                </button>
                <button
                  type="button"
                  id="sys-tab-management"
                  onClick={() => setSysSettingsTab("management")}
                  className={`px-5 py-3 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                    sysSettingsTab === "management"
                      ? "border-emerald-600 text-emerald-800 font-extrabold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>プランター管理設定</span>
                </button>
              </div>

              {/* 1. Collaboration / Members Settings Card */}
              {sysSettingsTab === "coop" && (
                <div className="border border-slate-100 rounded-2xl p-6 bg-white space-y-4 text-left shadow-xs animate-in fade-in duration-200">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    共同栽培・共有（お手伝い）設定
                  </h3>
                  
                  <div className="bg-teal-50/40 p-4.5 rounded-2xl border border-teal-100/50 flex gap-3 text-xs leading-relaxed text-teal-900">
                    <Users className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 w-full">
                      <h4 className="font-extrabold text-teal-850">プランター共同栽培・共有機能</h4>
                      <p className="text-slate-600 font-sans leading-relaxed">
                        共有は<strong>プランター（栽培環境・鉢）ごと</strong>行われます。招待したメンバーは、このプランター「<span className="font-bold text-teal-950">{sys.name}</span>」に登録されているすべての植物の成長ログ、施肥・お世話スケジュール、AIチャット診断ログをリアルタイムで共同編集・管理できるようになります。
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                    
                    {/* Current Active cultivation members lists */}
                    <div className="space-y-4">
                      <h4 className="font-extrabold text-slate-800 text-xs">プランター栽培メンバー ({sys.members?.length || 1})</h4>
                      
                      <div className="space-y-2.5 font-sans">
                        {sys.members?.map((mem: any, idx: number) => {
                          const isMyself = mem.userId === user?.id;
                          const isOwner = sys.currentUserRole === "owner";
                          const showActionBtn = (!isMyself && isOwner) || (isMyself && mem.role !== "owner");
                          
                          return (
                            <div key={mem.userId || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                              <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-slate-800 truncate">{mem.name}</span>
                                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    mem.role === "owner" ? "bg-amber-50 text-amber-800 border border-amber-100" : "bg-teal-50 text-teal-800 border border-teal-100"
                                  }`}>
                                    {mem.role === "owner" ? "オーナー" : "お手伝い"}
                                  </span>
                                  {isMyself && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded shrink-0">あなた</span>}
                                </div>
                                <span className="text-[10px] text-slate-400 break-all block truncate">{mem.email}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {mem.role === "owner" && (
                                  <span className="text-[10px] font-mono font-bold text-slate-500 mr-1 flex items-center gap-1">
                                    👑 オーナー
                                  </span>
                                )}
                                
                                {/* Transfer ownership button */}
                                {isOwner && !isMyself && mem.role !== "owner" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      requestConfirm(
                                        "オーナー権限の譲渡",
                                        `本当に「${mem.name}」さんに、このプランター「${sys.name}」のオーナー（代表権）を譲渡しますか？\n\n※譲渡後、あなた自身は共同栽培メンバー（お手伝い）となり、プランターの削除や他のメンバーの解任、オーナー権限の変更操作は行えなくなります。`,
                                        () => {
                                          onTransferOwnership(sys.id, mem.userId);
                                          triggerToast(`「${mem.name}」さんにオーナー権限を譲渡しました。`);
                                        }
                                      );
                                    }}
                                    className="p-1 px-1.5 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100 rounded-lg transition-all font-bold cursor-pointer"
                                    title="オーナー権限を他のメンバーに譲渡します"
                                  >
                                    オーナー譲渡
                                  </button>
                                )}

                                {showActionBtn && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const confirmTitle = isMyself ? "プランターの共同栽培から退出" : "メンバーの解任";
                                      const confirmMsg = isMyself
                                        ? `本当にこのプランター（${sys.name}）の共同栽培メンバーから退出しますか？共有されている全ての植物から退出となります。`
                                        : `本当に「${mem.name}」さんをこのプランター（${sys.name}）の共同栽培メンバーから解任（削除）しますか？`;
                                      
                                      requestConfirm(
                                        confirmTitle,
                                        confirmMsg,
                                        () => {
                                          onRemoveMember(sys.id, mem.userId);
                                          triggerToast(isMyself ? "共同栽培から退出しました。" : `「${mem.name}」さんを解任しました。`);
                                          if (isMyself) {
                                            setActiveSystemSettingsId(null);
                                          }
                                        }
                                      );
                                    }}
                                    className="p-1 px-1.5 text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition-all font-bold cursor-pointer"
                                    title={isMyself ? "退出する" : "解任する"}
                                  >
                                    {isMyself ? "🥾 退出" : "✕ 解任"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cultivator invitation form section */}
                    <div className="space-y-4 font-sans">
                      <h4 className="font-extrabold text-slate-800 text-xs text-left">プランター共有メンバーの招待</h4>
                      
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          const email = sysInviteEmails[sys.id] || "";
                          if (!email) return;
                          onInviteMember(sys.id, email);
                          setSysInviteEmails(prev => ({ ...prev, [sys.id]: "" }));
                        }} 
                        className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4"
                      >
                        <div className="text-left">
                          <label className="block text-slate-500 text-[10.5px] font-bold mb-1.5 flex items-center gap-1">
                            <span>📧</span> 招待するパートナーのメールアドレス
                          </label>
                          <input 
                            type="email"
                            required
                            value={sysInviteEmails[sys.id] || ""}
                            onChange={(e) => setSysInviteEmails(prev => ({ ...prev, [sys.id]: e.target.value }))}
                            placeholder="例: companion@example.com"
                            className="w-full px-3 py-1.5 text-base md:text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                          />
                          <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                            ※招待を送信すると、お相手のアカウントからこのプランターおよび中のすべての植物にアクセスできるようになります。
                          </p>
                        </div>
                        
                        <button 
                          type="submit"
                          className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>👥</span> プランター全体を共同栽培する
                        </button>
                      </form>
                    </div>

                  </div>
                </div>
              )}

              {/* 2. Management settings Card */}
              {sysSettingsTab === "management" && (
                <div className="border border-slate-100 rounded-2xl p-6 bg-white space-y-4 text-left shadow-xs animate-in fade-in duration-200">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-500" />
                    プランター管理設定
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    プランターの稼働状態（一時休止・稼働再開）や、データの完全な削除を行うことができます。
                  </p>

                  <div className="border-t border-slate-150/40 pt-5 space-y-5">
                    {/* Water / pause active system */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-755 flex items-center gap-1.5 font-sans">
                          <span>⏸️</span> プランターの稼働切替（一時休止/再開）
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                          {sys.suspended 
                            ? "現在、このプランターは一時休止中です。再開するとリストに再表示され、再び植物を追加できます。" 
                            : "プランターを一時休止すると、現在栽培中の植物はすべて『栽培完了・アーカイブ』へ安全に移動され、プランター全体が非表示状態になります（データは削除されません）。"}
                        </p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          if (sys.suspended) {
                            requestConfirm(
                              "プランターの稼働再開",
                              `本当にこのプランター「${sys.name}」の稼働を再開しますか？`,
                              () => {
                                onUpdateSystem(sys.id, { suspended: false });
                                triggerToast(`「${sys.name}」の稼働を再開しました！`);
                              }
                            );
                          } else {
                            requestConfirm(
                              "プランターの一時休止",
                              `本当にこのプランター「${sys.name}」を一時休止しますか？現在栽培中の植物はすべて『栽培完了・アーカイブ』へ安全に移動されます（データは削除されません）。`,
                              () => {
                                onUpdateSystem(sys.id, { suspended: true });
                                triggerToast(`「${sys.name}」を休止し、すべての植物をアーカイブ化しました。`);
                              }
                            );
                          }
                        }}
                        className={`sm:w-auto w-full px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:scale-[1.01] transition-all rounded-xl cursor-pointer border shrink-0 ${
                          sys.suspended 
                            ? "text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100" 
                            : "text-slate-700 bg-slate-100 border-slate-100 hover:bg-slate-205 py-2 px-4 shadow-3xs"
                        }`}
                      >
                        {sys.suspended ? "▶️ 稼働を再開する" : "⏸️ プランターを休止する"}
                      </button>
                    </div>

                    {/* Complete delete system */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-rose-50/30 rounded-xl border border-rose-100/50">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5 font-sans">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          プランターの完全撤去（削除）
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                          【警告】間違えて作成した場合などに使用してください。このプランターにこれまで登録された植物やログデータなどは<strong>「すべて完全に削除」</strong>され、元に戻せません。履歴を残したい場合は一時休止をご利用ください。
                        </p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          requestConfirm(
                            "プランターの完全撤去（データ削除）",
                            `【警告】本当にこのプランター「${sys.name}」を完全に撤去（削除）しますか？これまでに登録された植物やログデータなどは『すべて完全に削除』され、元に戻せません。`,
                            () => {
                              onDeleteSystem(sys.id);
                              triggerToast(`「${sys.name}」とその全データを削除しました。`);
                              setActiveSystemSettingsId(null);
                            }
                          );
                        }}
                        className="sm:w-auto w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white hover:scale-[1.01] transition-all text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> プランターを削除する
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()
      ) : !selectedPlant ? (
        <div className="space-y-6">
          
          {/* Header Action cards */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-600" /> プランターと植物プロファイル
              </h2>
              <p className="text-slate-500 text-xs">プランター・菜園畑・室内水耕まで、栽培環境と植物のプロファイルを一元管理できます。</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowAddSys(!showAddSys)}
                className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> プランターを追加する
              </button>
            </div>
          </div>

          {/* Active / Archive Toggle Tabs */}
          <ActiveArchivedTabs
            viewArchived={viewArchived}
            onToggle={setViewArchived}
            activeCount={plants.filter(p => !p.archived).length}
            archiveCount={plants.filter(p => p.archived).length}
          />

          {/* ADD SYSTEM FORM SLIDER */}
          {showAddSys && (
            <form onSubmit={handleCreateSystem} className="bg-slate-50 border border-slate-100 p-6 rounded-2xl space-y-4 max-w-xl">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                <PlusCircle className="text-emerald-600 w-4.5 h-4.5" /> プランターの新規登録
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">プランター名・栽培環境名</label>
                  <input 
                    type="text" 
                    value={newSysName} 
                    onChange={(e) => setNewSysName(e.target.value)}
                    required
                    placeholder="例: ベランダの大型トマト袋、リビング水耕棚"
                    className="w-full px-3 py-2 text-base md:text-xs bg-white border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-xl text-slate-700 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">プランター種別・環境タイプ</label>
                  <select 
                    value={newSysType} 
                    onChange={(e) => setNewSysType(e.target.value as SystemType)}
                    className="w-full px-3 py-2 text-base md:text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-sans"
                  >
                    <option value="Soil_Planter">ベランダプランター栽培 (土耕)</option>
                    <option value="Backyard_Field">お庭の菜園・市民農園 (露地畑)</option>
                    <option value="DWC">水耕: DWC (深水エアー循環式)</option>
                    <option value="NFT">水耕: NFT (薄膜傾斜流下式)</option>
                    <option value="Kratky">水耕: Kratky (ノンエアー密閉ボトル)</option>
                    <option value="Ebb_Flow">水耕: Ebb & Flow (潮汐満排水式)</option>
                    <option value="Other">その他 (砂利・ハイドロコーン等)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">栽培容器や土壌設定のメモ説明</label>
                <textarea 
                  value={newSysDesc} 
                  onChange={(e) => setNewSysDesc(e.target.value)}
                  placeholder="元肥の配合、土の量、LED自動タイマーの時間、プランター容量など自由記入"
                  className="w-full p-3 text-base md:text-xs bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-slate-700 h-16 resize-none font-sans"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowAddSys(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-500 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  プランターを登録
                </button>
              </div>
            </form>
          )}

          {/* ADD PLANT FORM SLIDER */}
          {showAddPlant && (
            <form onSubmit={handleCreatePlant} className="bg-slate-50 border border-slate-100 p-6 rounded-2xl space-y-4 max-w-xl">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                <PlusCircle className="text-emerald-600 w-4.5 h-4.5" /> プラント栽培開始 (新規登録)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">植物名 / ニックネーム</label>
                  <input 
                    type="text" 
                    value={newPlantName} 
                    onChange={(e) => setNewPlantName(e.target.value)}
                    required
                    placeholder="例: フリルサラダレタス1号"
                    className="w-full px-3 py-2 text-base md:text-xs bg-white border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-xl text-slate-700 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">具体的な品種</label>
                  <input 
                    type="text" 
                    value={newPlantVariety} 
                    onChange={(e) => setNewPlantVariety(e.target.value)}
                    placeholder="例: ジェノベーゼ / アイコ / ハバネロ"
                    className="w-full px-3 py-2 text-base md:text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">現在のステージ</label>
                  <select 
                    value={newPlantStage} 
                    onChange={(e) => setNewPlantStage(e.target.value as PlantStage)}
                    className="w-full px-3 py-2 text-base md:text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-sans"
                  >
                    <option value="seedling">苗木・幼苗期 (seedling)</option>
                    <option value="vegetative">栄養成長・葉肉旺盛期 (vegetative)</option>
                    <option value="flowering">開花・結実誘発期 (flowering)</option>
                    <option value="harvest">収穫盛ん期 (harvest)</option>
                    <option value="finished">栽培完了・不耕起終了 (finished)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">設置/種まき日 (sowing_date)</label>
                  <input 
                    type="date" 
                    value={newPlantSowing} 
                    onChange={(e) => setNewPlantSowing(e.target.value)}
                    className="w-full max-w-[130px] px-3 py-2 text-base md:text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-sans font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1 font-sans">予想収穫予定日</label>
                  <input 
                    type="date" 
                    value={newPlantHarvest} 
                    onChange={(e) => setNewPlantHarvest(e.target.value)}
                    className="w-full max-w-[130px] px-3 py-2 text-base md:text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-sans font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowAddPlant(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-500 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  プラントを登録して栽培開始
                </button>
              </div>
            </form>
          )}

          {/* ACTIVE SYSTEMS WRAPPER LISTS */}
          <div className="space-y-8">
            {/* 稼働中のプランター */}
            {systems.filter(s => !s.suspended).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 px-1 text-left">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-50"></span>
                  </span>
                  稼働中のプランター ({systems.filter(s => !s.suspended).length})
                </h3>
                <div className="space-y-6">
                  {systems.filter(s => !s.suspended).map((sys) => {
                    const sysPlants = plants.filter(p => p.systemId === sys.id && (viewArchived ? !!p.archived : !p.archived));

                    return (
                      <div key={sys.id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
                        <div className="flex justify-between items-start gap-4 flex-wrap">
                          <div className="space-y-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                {sys.type === 'DWC' ? 'DWC水耕' : sys.type === 'NFT' ? 'NFT流下' : sys.type === 'Kratky' ? 'Kratky静置' : sys.type === 'Soil_Planter' ? '土耕プランター' : sys.type === 'Backyard_Field' ? '露地畑/家庭菜園' : 'その他環境'}
                              </span>
                              <h3 className="font-extrabold text-slate-850 text-base">{sys.name}</h3>
                            </div>
                            <p className="text-slate-500 text-xs leading-relaxed">{sys.description || "このプランターについてのメモ説明はありません。"}</p>
                          </div>

                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setSysIdForNewPlant(sys.id);
                                setShowAddPlant(true);
                              }}
                              className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-55 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> 植物を追加
                            </button>

                            <button
                              onClick={() => {
                                setActiveSystemSettingsId(sys.id);
                              }}
                              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-205 hover:bg-slate-200 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                              title="プランター設定（メンバー追加、休止、削除）"
                            >
                              <Settings className="w-3.5 h-3.5" /> プランター設定
                            </button>
                          </div>
                        </div>

                        {/* PLANTS IN THIS SYSTEM ROW CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
                          {sysPlants.length === 0 ? (
                            <div className="col-span-full border border-dashed border-slate-100 rounded-2xl p-6 text-center text-slate-400 text-xs bg-slate-50/10">
                              このプランターには現在アクティブな植物がありません。
                            </div>
                          ) : (
                            sysPlants.map((p) => {
                              let alertBadge = null;
                              const haspHAlert = p.latestPh && (p.latestPh < 5.8 || p.latestPh > 6.5);
                              const hasTempAlert = p.latestWaterTemp && p.latestWaterTemp > 24.5;
                              
                              if (haspHAlert || hasTempAlert) {
                                alertBadge = (
                                  <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                    <AlertTriangle className="w-3 h-3 text-white" /> 要水質調整
                                  </span>
                                );
                              }

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
                                  className="group bg-slate-50/50 hover:bg-white border hover:border-emerald-300 rounded-xl p-4.5 cursor-pointer flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-xs"
                                >
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                      <h4 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors text-sm">{p.name}</h4>
                                      <div className="flex gap-1.5">
                                        {alertBadge}
                                        <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                          {p.stage === 'seedling' ? '幼苗期' : p.stage === 'vegetative' ? '栄養期' : p.stage === 'flowering' ? '開花期' : p.stage === 'harvest' ? '収穫期' : '終了'}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="text-[11px] text-slate-500 space-y-1">
                                      <div className="flex justify-between">
                                        <span>品種：</span>
                                        <span className="font-bold text-slate-700">{p.variety || "通常株"}</span>
                                      </div>
                                      <div className="flex justify-between font-mono">
                                        <span>種まき日：</span>
                                        <span>{p.sowingDate}</span>
                                      </div>
                                      {expDateStr && (
                                        <div className="flex justify-between items-baseline pt-1 border-t border-slate-100/50">
                                          <span>AI予測収穫：</span>
                                          <div className="text-[11px] flex items-baseline gap-1 font-sans font-bold">
                                            <span className="text-slate-800">{expDateStr}</span>
                                            {daysLeft !== null && (
                                              <span className={`text-[10px] ${daysLeft < 0 ? "text-rose-600" : daysLeft <= 3 ? "text-amber-600 animate-pulse font-extrabold" : daysLeft <= 10 ? "text-emerald-700" : "text-slate-500"}`}>
                                                ({daysLeft < 0 ? `経過+${Math.abs(daysLeft)}日` : `あと${daysLeft}日`})
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {prediction?.reason && (
                                      <div className="mt-2 text-[9.5px]/relaxed text-slate-500 font-sans italic border-l-2 border-emerald-200 pl-2 leading-relaxed" title={prediction.reason}>
                                        💡 {prediction.reason}
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-4 pt-4 border-t border-slate-100/60 flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex gap-2 text-[10px] text-slate-400 font-mono">
                                      <span>pH: <strong className={haspHAlert ? "text-amber-600 font-bold" : "text-slate-600"}>{p.latestPh ?? "ー"}</strong></span>
                                      <span>EC: <strong className="text-slate-600">{p.latestEc ? `${p.latestEc}` : "ー"}</strong></span>
                                      <span>気温: <strong className={hasTempAlert ? "text-amber-600 font-bold" : "text-slate-600"}>{p.latestWaterTemp ? `${p.latestWaterTemp}℃` : "ー"}</strong></span>
                                    </div>

                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 一時休止中のプランター */}
            {systems.filter(s => s.suspended).length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 px-1">
                  <span className="inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                  一時休止中のプランター ({systems.filter(s => s.suspended).length})
                </h3>
                <div className="space-y-6">
                  {systems.filter(s => s.suspended).map((sys) => {
                    const sysPlants = plants.filter(p => p.systemId === sys.id && (viewArchived ? !!p.archived : !p.archived));

                    return (
                      <div key={sys.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 opacity-80 hover:opacity-100 transition-opacity">
                        <div className="flex justify-between items-start gap-4 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-600 border border-slate-300">
                                休止中 / {sys.type === 'DWC' ? 'DWC水耕' : sys.type === 'NFT' ? 'NFT流下' : sys.type === 'Kratky' ? 'Kratky静置' : 'Other'}
                              </span>
                              <h3 className="font-extrabold text-slate-600 text-base line-through">{sys.name}</h3>
                            </div>
                            <p className="text-slate-400 text-xs leading-relaxed">{sys.description || "このプランターについてのメモ説明はありません。"}</p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setActiveSystemSettingsId(sys.id);
                              }}
                              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                              title="プランター設定（メンバー追加、再開、削除）"
                            >
                              <Settings className="w-3.5 h-3.5" /> プランター設定
                            </button>
                          </div>
                        </div>

                        {/* PLANTS IN THIS SYSTEM ROW CARDS – ONLY VISIBLE IF ARCHIVED TAB AND HAS PLANTS */}
                        {viewArchived && sysPlants.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2 border-t border-slate-200 border-dashed">
                            {sysPlants.map((p) => (
                              <div 
                                key={p.id}
                                onClick={() => onSelectPlant(p.id)}
                                className="group bg-white/60 hover:bg-white border hover:border-emerald-300 rounded-xl p-4.5 cursor-pointer flex flex-col justify-between transition-all"
                              >
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-bold text-slate-600 text-sm">{p.name} (終了)</h4>
                                  </div>
                                  <div className="text-[11px] text-slate-400 space-y-1">
                                    <div className="flex justify-between">
                                      <span>品種：</span>
                                      <span>{p.variety || "通常株"}</span>
                                    </div>
                                    <div className="flex justify-between font-mono">
                                      <span>種まき日：</span>
                                      <span>{p.sowingDate}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-100/60 flex items-center justify-between">
                                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">栽培終了(アーカイブ)</span>
                                  <ChevronRight className="w-4 h-4 text-slate-300" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {systems.length === 0 && (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-500">
                <p className="font-bold text-slate-750 mb-1">プランターが登録されていません</p>
                <p className="text-xs text-slate-400">まずは上の「プランターを追加する」ボタンから登録しましょう！</p>
              </div>
            )}
          </div>

        </div>
      ) : (
        
        /* SELECTED PLANT FULL PAGE PROFILE AND INTERACTIVE ADVISOR TAB-SHEETS */
        <div className="space-y-6">
          
          {/* Back controller and title headers */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => onSelectPlant(null)}
                className="p-2 hover:bg-slate-50 border border-slate-150 rounded-xl text-slate-600 cursor-pointer transition-colors"
                title="植物一覧に戻る"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div id="plant-details-breadcrumbs" className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">
                  {selectedPlant.system ? selectedPlant.system.name : "ハイドロプランター"} &gt; 品種: {selectedPlant.variety}
                </div>
                <h2 className="text-lg font-extrabold text-slate-800 tracking-tight mt-0.5">
                  🌱 {selectedPlant.name}
                </h2>
              </div>
            </div>
          </div>

          {/* TODAY RECOMENDED TASKS WIDGET */}
          {selectedPlant.proposals && selectedPlant.proposals.filter((p: any) => {
            const isApproved = p.status === "approved" || p.status === "pending";
            const todayStr = new Date().toISOString().split("T")[0];
            return isApproved && p.proposedDate === todayStr;
          }).length > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5 space-y-4 font-sans shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 mt-0">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                  本日の推奨お世話タスク ({selectedPlant.proposals.filter((p: any) => {
                    const isApproved = p.status === "approved" || p.status === "pending";
                    const todayStr = new Date().toISOString().split("T")[0];
                    return isApproved && p.proposedDate === todayStr;
                  }).length} 件)
                </h3>
                <span className="text-[10px] text-emerald-600 bg-white border border-emerald-100 font-bold px-2 py-0.5 rounded-full shadow-xs">
                  AI連携
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPlant.proposals
                  .filter((p: any) => {
                    const isApproved = p.status === "approved" || p.status === "pending";
                    const todayStr = new Date().toISOString().split("T")[0];
                    return isApproved && p.proposedDate === todayStr;
                  })
                  .map((task: any, index: number) => {
                    let taskBadge = "bg-purple-100 text-purple-800 text-[10px]";
                    let taskTitle = "お世話タスク";
                    if (task.type === "watering") {
                      taskBadge = "bg-blue-100 text-blue-800 border border-blue-200/55";
                      taskTitle = "水やり・潅水";
                    } else if (task.type === "nutrient") {
                      taskBadge = "bg-amber-100 text-amber-800 border border-amber-200/55";
                      taskTitle = "肥料・追肥推奨";
                    } else if (task.type === "ph_check") {
                      taskBadge = "bg-teal-100 text-teal-800 border border-teal-200/55";
                      taskTitle = "pH水質測定";
                    } else if (task.type === "harvest") {
                      taskBadge = "bg-emerald-100 text-emerald-800 border border-emerald-200/55";
                      taskTitle = "推奨収穫期";
                    }

                    return (
                      <div key={task.id || index} className="p-4 bg-white rounded-xl border border-emerald-50 shadow-xs flex flex-col justify-between gap-3 hover:border-emerald-200 transition-all">
                        <div className="space-y-1.5 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${taskBadge}`}>
                              {taskTitle}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              期限: {task.proposedDate || "本日"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans mt-0.5">
                            {task.note}
                          </p>
                        </div>
                        <div className="flex gap-2 justify-end pt-2 border-t border-slate-50">
                          <button
                            type="button"
                            onClick={() => handleCompleteTask(task)}
                            className="px-3.5 py-1.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] transition-all rounded-lg flex items-center gap-0.5 shadow-xs cursor-pointer"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            実施完了にして記録
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* PLANT SUB TABS NAVIGATION */}
          <div className="flex border-b border-slate-100 text-xs flex-wrap font-sans">
            <button 
              id="tab-btn-logs"
              onClick={() => setActiveTab("logs")}
              className={`px-4.5 py-3 font-bold border-b-2 transition-all cursor-pointer ${activeTab === "logs" ? "border-emerald-600 text-emerald-800 font-extrabold" : "border-transparent text-slate-500 hover:text-slate-100"}`}
            >
              📊 栽培記録
            </button>
            <button 
              id="tab-btn-nutrients"
              onClick={() => setActiveTab("nutrients")}
              className={`px-4.5 py-3 font-bold border-b-2 transition-all cursor-pointer ${activeTab === "nutrients" ? "border-emerald-600 text-emerald-800 font-extrabold" : "border-transparent text-slate-500 hover:text-slate-100"}`}
            >
              🧪 液肥肥料管理
            </button>
            <button 
              id="tab-btn-ai"
              onClick={() => setActiveTab("ai")}
              className={`px-4.5 py-3 font-bold border-b-2 transition-all cursor-pointer ${activeTab === "ai" ? "border-emerald-600 text-emerald-800 font-extrabold" : "border-transparent text-slate-500 hover:text-slate-100"}`}
            >
              ✨ AIアドバイザー
            </button>
            <button 
              id="tab-btn-photos"
              onClick={() => setActiveTab("photos")}
              className={`px-4.5 py-3 font-bold border-b-2 transition-all cursor-pointer ${activeTab === "photos" ? "border-emerald-600 text-emerald-800 font-extrabold" : "border-transparent text-slate-500 hover:text-slate-100"}`}
            >
              📷 成長写真アルバム
            </button>
            <button 
              id="tab-btn-settings"
              onClick={() => setActiveTab("settings")}
              className={`px-4.5 py-3 font-bold border-b-2 transition-all cursor-pointer ${activeTab === "settings" ? "border-emerald-600 text-emerald-800 font-extrabold" : "border-transparent text-slate-500 hover:text-slate-100"}`}
            >
              ⚙️ 設定
            </button>
          </div>

          {/* TAB CONTENT CARDS CONTAINER */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            
            {/* 1. GROW WATER LOGS TAB */}
            {activeTab === "logs" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Water/Soil logs input form */}
                  <form onSubmit={handleAddLogSubmit} className="lg:col-span-1 bg-slate-50/50 border border-slate-100 p-5 rounded-xl space-y-4">
                    <h3 className="text-xs uppercase font-extrabold text-slate-700 tracking-wider mb-2 flex items-center gap-1">
                      <FlaskConical className="w-4.5 h-4.5 text-emerald-600" /> 
                      {isSoil ? "今日の栽培観察を記録" : "今日の測定データを記録"}
                    </h3>
                    
                    {user.showPhEc !== false && (
                      <>
                        <div>
                          <label className="block text-slate-500 text-[10.5px] font-bold mb-1">
                            {isSoil ? "土壌酸度 pH値 (任意)" : "水素イオン指数 pH 値"}
                          </label>
                          <input 
                            type="number" 
                            step="0.1"
                            min="2"
                            max="12"
                            value={logPh}
                            onChange={(e) => setLogPh(e.target.value)}
                            placeholder={isSoil ? "例: 6.5 (簡易測定器)" : "例: 6.2"}
                            className="w-full px-3 py-1.5 text-base md:text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-500 text-[10.5px] font-bold mb-1">
                            {isSoil ? "土壌 EC値 / 栄養濃度 (任意)" : "電気伝導度 EC値 (mS/cm)"}
                          </label>
                          <input 
                            type="number" 
                            step="0.05"
                            min="0"
                            max="5"
                            value={logEc}
                            onChange={(e) => setLogEc(e.target.value)}
                            placeholder={isSoil ? "測定したもののみ" : "例: 1.4"}
                            className="w-full px-3 py-1.5 text-base md:text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-mono"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-slate-500 text-[10.5px] font-bold mb-1 flex justify-between items-center">
                        <span>{isSoil ? "周囲気温 または 地温 (℃)" : "追加時の気温 (℃)"}</span>
                        <button
                          type="button"
                          disabled={fetchingTemp}
                          onClick={handleFetchCurrentTemp}
                          className="text-[9.5px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded cursor-pointer disabled:opacity-50"
                        >
                          {fetchingTemp ? "計測中..." : "🌤 気温を自動取得"}
                        </button>
                      </label>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="40"
                        value={logTemp}
                        onChange={(e) => setLogTemp(e.target.value)}
                        placeholder="例: 22.5"
                        className="w-full px-3 py-1.5 text-base md:text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2 py-1 bg-white p-2 rounded-lg border border-slate-200/60">
                      <input 
                        type="checkbox" 
                        id="logWatered"
                        checked={logWatered}
                        onChange={(e) => setLogWatered(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="logWatered" className="text-slate-700 text-xs font-bold cursor-pointer select-none flex items-center gap-1 font-sans">
                        💧 水やりを実施した
                      </label>
                    </div>

                    <div>
                      <label className="block text-slate-500 text-[10.5px] font-bold mb-1">
                        栽培・手入れ観察メモ (任意)
                      </label>
                      <textarea 
                        value={logNote}
                        onChange={(e) => setLogNote(e.target.value)}
                        required={false}
                        placeholder={isSoil ? "例: 土の表面が少し乾いていた。わき芽を3つ摘み取りました。一部黄色くなった下葉を除去。" : "葉の色が良くなってきた、エアーを強くした、など観察記録用のメモ"}
                        className="w-full p-2.5 text-base md:text-xs bg-white border border-slate-200 rounded-lg text-slate-700 h-24 md:h-16 resize-y font-sans min-h-[85px]"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 text-[10.5px] font-bold mb-1 flex items-center gap-1">
                        📸 状況写真の添付 (複数可・任意)
                      </label>
                      {logPhotoBase64s.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                          {logPhotoBase64s.map((b64, idx) => (
                            <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-1">
                              <img src={b64} alt={`ログ添付画像 ${idx + 1}`} className="w-full h-24 object-cover rounded-md font-sans text-xs" referrerPolicy="no-referrer" />
                              <button
                                type="button"
                                onClick={() => setLogPhotoBase64s((prev) => prev.filter((_, i) => i !== idx))}
                                className="absolute top-1.5 right-1.5 bg-slate-900/75 hover:bg-slate-900 text-white rounded-full p-1.5 transition-colors cursor-pointer flex items-center justify-center"
                                title="写真を削除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <label className="flex flex-col items-center justify-center border border-dashed border-slate-250 bg-white rounded-xl py-4 px-2 hover:bg-slate-50 cursor-pointer transition-colors text-center">
                          <Camera className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-[11px] font-bold text-slate-500">
                            {logPhotoBase64s.length > 0 ? "写真をさらに撮影・追加する" : "写真を撮影・添付する"}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {logPhotoBase64s.length > 0 ? "追加の画像を選択、またはカメラ起動" : "タップしてカメラ起動・画像選択 (複数枚の添付に対応)"}
                          </span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple
                            onChange={(e) => {
                              const files = e.target.files;
                              if (!files) return;
                              Array.from(files).forEach((file: any) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setLogPhotoBase64s((prev) => [...prev, reader.result as string]);
                                };
                                reader.readAsDataURL(file);
                              });
                            }}
                            className="hidden" 
                          />
                        </label>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-sans rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      {isSoil ? "観察ログを保存" : "測定ログを追加"}
                    </button>
                  </form>

                  {/* Water logs history logs table */}
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      これまでの測定データ履歴 ({selectedPlant.growLogs?.length || 0} 件)
                    </h3>

                    {(!selectedPlant.growLogs || selectedPlant.growLogs.length === 0) ? (
                      <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-xl text-xs border border-dashed border-slate-100">
                        まだ水質測定データがありません。今日の様子を記録してみましょう。
                      </div>
                    ) : (
                      <>
                        {/* デスクトップ用テーブルビュー (md幅以上) */}
                        <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-xs">
                          <table className="w-full text-left text-xs text-slate-600 border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-mono uppercase">
                                <th className="p-3.5 font-bold">日付</th>
                                <th className="p-3.5 font-bold">測定者</th>
                                <th className="p-3.5 font-bold text-center">水やり</th>
                                <th className="p-3.5 font-bold text-center">pH 値</th>
                                <th className="p-3.5 font-bold text-center">EC (mS/cm)</th>
                                <th className="p-3.5 font-bold text-center">気温/温度</th>
                                <th className="p-3.5 font-bold">状態メモ</th>
                                <th className="p-3.5 font-bold text-center">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedPlant.growLogs.map((log: any, index: number) => {
                                const pHAler = log.ph && (log.ph < 5.8 || log.ph > 6.5);
                                const tempAler = log.waterTemp && log.waterTemp > 24.5;
                                const dateShort = log.loggedAt ? log.loggedAt.split("T")[0] : "不明";
                                const canEdit = log.postedBy === user.id || selectedPlant.userId === user.id;



                                return (
                                  <tr key={log.id || index} id={`grow-log-row-${log.id}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">{dateShort}</td>
                                    <td className="p-3.5 font-bold text-slate-700 whitespace-nowrap">{log.postedByName || "メンバー"}</td>
                                    <td className="p-3.5 text-center whitespace-nowrap">
                                      {log.watered !== false ? (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-extrabold rounded-full border border-blue-100">
                                          💧 実施
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full border border-slate-200">
                                          🔍 観察のみ
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3.5 text-center whitespace-nowrap font-mono font-bold">
                                      <span className={`px-2 py-0.5 rounded ${pHAler ? "bg-amber-100 text-amber-800 ring-2 ring-amber-50" : "bg-emerald-50 text-emerald-800"}`}>
                                        {log.ph ?? "ー"}
                                      </span>
                                    </td>
                                    <td className="p-3.5 text-center font-mono whitespace-nowrap text-slate-600">{log.ec ?? "ー"}</td>
                                    <td className="p-3.5 text-center whitespace-nowrap font-mono font-bold">
                                      <span className={tempAler ? "text-amber-600" : "text-emerald-700"}>
                                        {log.waterTemp ? `${log.waterTemp}℃` : "ー"}
                                      </span>
                                    </td>
                                    <td className="p-3.5 text-slate-500 font-sans leading-relaxed">
                                      <div className="flex items-start gap-2.5">
                                        {log.imageUrl && (
                                          <div className="flex-shrink-0 group relative cursor-pointer">
                                            <img 
                                              src={log.imageUrl} 
                                              alt="測定・観察写真" 
                                              className="w-12 h-12 rounded-lg object-cover border border-slate-100 hover:scale-110 active:scale-95 transition-transform duration-200 shadow-xs"
                                              onClick={() => setSelectedPhotoLog(log)}
                                              referrerPolicy="no-referrer"
                                            />
                                          </div>
                                        )}
                                        <div className="text-xs text-slate-600 font-sans leading-relaxed self-center">
                                          {log.note || "ー"}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3.5 text-center whitespace-nowrap">
                                      {canEdit ? (
                                        <div className="flex gap-2 justify-center">
                                          <button 
                                            type="button"
                                            onClick={() => startEditGrowLog(log)}
                                            className="text-slate-450 hover:text-indigo-650 transition-colors cursor-pointer"
                                            title="編集"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={() => handleDeleteGrowLogClick(log.id)}
                                            className="text-slate-450 hover:text-rose-600 transition-colors cursor-pointer"
                                            title="削除"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-300">閲覧のみ</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* モバイル用カードリストビュー (md幅未満) */}
                        <div className="block md:hidden space-y-3">
                          {selectedPlant.growLogs.map((log: any, index: number) => {
                            const pHAler = log.ph && (log.ph < 5.8 || log.ph > 6.5);
                            const tempAler = log.waterTemp && log.waterTemp > 24.5;
                            const dateShort = log.loggedAt ? log.loggedAt.split("T")[0] : "不明";
                            const canEdit = log.postedBy === user.id || selectedPlant.userId === user.id;



                            return (
                              <div key={log.id || index} id={`grow-log-card-${log.id}`} className="p-4 bg-white border border-slate-100 rounded-xl shadow-xs space-y-2.5 text-left">
                                <div className="flex justify-between items-center">
                                  <span className="font-mono text-slate-400 font-semibold">{dateShort}</span>
                                  <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">{log.postedByName || "メンバー"}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {log.watered !== false ? (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-extrabold rounded-md border border-blue-100">
                                      💧 水やりを実施した
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] rounded-md border border-slate-200">
                                      🔍 観察のみ
                                    </span>
                                  )}
                                  
                                  {log.ph !== undefined && log.ph !== null && log.ph !== "" && (
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${pHAler ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
                                      pH: {log.ph}
                                    </span>
                                  )}

                                  {log.ec !== undefined && log.ec !== null && log.ec !== "" && (
                                    <span className="px-2 py-0.5 bg-slate-55 text-slate-600 text-[10px] font-bold rounded-md border border-slate-100">
                                      EC: {log.ec}
                                    </span>
                                  )}

                                  {log.waterTemp !== undefined && log.waterTemp !== null && log.waterTemp !== "" && (
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${tempAler ? "bg-amber-50 text-amber-700 font-bold" : "bg-teal-50 text-teal-800"}`}>
                                      温度: {log.waterTemp}℃
                                    </span>
                                  )}
                                </div>
                                
                                {log.note && (
                                  <p className="text-xs text-slate-600 font-sans leading-relaxed bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/30">
                                    {log.note}
                                  </p>
                                )}

                                {log.imageUrl && (
                                  <div className="pt-1 select-none">
                                    <img 
                                      src={log.imageUrl} 
                                      alt="測定・観察写真" 
                                      className="w-full max-h-48 rounded-xl object-contain bg-slate-50 border border-slate-200/50 cursor-pointer shadow-xs active:scale-98 transition-transform"
                                      onClick={() => setSelectedPhotoLog(log)}
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                )}

                                {canEdit && (
                                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100/50">
                                    <button 
                                      type="button"
                                      onClick={() => startEditGrowLog(log)}
                                      className="px-3 py-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-all cursor-pointer active:scale-95"
                                      style={{ minHeight: "34px" }}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" /> 編集
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleDeleteGrowLogClick(log.id)}
                                      className="px-3 py-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-1 hover:bg-rose-100 transition-all cursor-pointer active:scale-95"
                                      style={{ minHeight: "34px" }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> 削除
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* 2. NUTRIENT LOGS TAB */}
            {activeTab === "nutrients" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Nutrient logs input form */}
                  <form onSubmit={handleAddNutSubmit} className="lg:col-span-1 bg-slate-50/50 border border-slate-100 p-5 rounded-xl space-y-4">
                    <h3 className="text-xs uppercase font-extrabold text-slate-700 tracking-wider mb-2 flex items-center gap-1.5">
                      <FlaskConical className="w-4.5 h-4.5 text-indigo-600" /> 
                      {isSoil ? "今日の肥料記録を追加" : "今日の液肥投入を記録"}
                    </h3>
                    
                    <div>
                      <label className="block text-slate-500 text-[10.5px] font-bold mb-1">使用肥料・ブランド</label>
                      <select 
                        value={nutBrand}
                        onChange={(e) => setNutBrand(e.target.value)}
                        className="w-full px-3 py-1.5 text-base md:text-xs bg-white border border-slate-200 rounded-lg text-slate-750 font-sans"
                      >
                        {isSoil ? (
                          <>
                            <option value="マイガーデン / 固形ばらまき肥料 (置肥)">マイガーデン / 固形ばらまき肥料 (置肥)</option>
                            <option value="マグァンプK / 緩効性粒状元肥">マグァンプK / 緩効性粒状元肥</option>
                            <option value="ハイポネックス原液 (土壌散布用液肥)">ハイポネックス原液 (土耕希釈液肥)</option>
                            <option value="有機100% 固形発酵油かす肥料">有機100% 固形発酵油かす肥料</option>
                            <option value="微粉ハイポネックス (カリ成分強化)">微粉ハイポネックス</option>
                            <option value="その他日本仕様希釈肥料">その他・自作ブレンド肥料</option>
                          </>
                        ) : (
                          <>
                            <option value="ハイポニカ液体肥料 (A液+B液)">ハイポニカ液体肥料 (A液+B液)</option>
                            <option value="OATハウス (旧大塚ハウス水耕液)">OATハウス (旧大塚配合)</option>
                            <option value="微粉ハイポネックス (カリ配合)">微粉ハイポネックス</option>
                            <option value="その他日本仕様希釈肥料">その他水耕栽培用肥料</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-500 text-[10.5px] font-bold mb-1">希釈倍率 (※固形肥料は【希釈なし】を選択)</label>
                      <select 
                        value={nutDilution}
                        onChange={(e) => setNutDilution(e.target.value)}
                        className="w-full px-3 py-1.5 text-base md:text-xs bg-white border border-slate-200 rounded-lg text-slate-750"
                      >
                        {isSoil && <option value="1">希釈なし (そのまま撒く・置肥)</option>}
                        <option value="1000">1000倍 希釈 (土耕・葉面散布標準)</option>
                        <option value="500">500倍 希釈 (水耕標準 / 野菜追肥用)</option>
                        <option value="2000">2000倍 希釈 (幼苗用・薄め)</option>
                        <option value="250">250倍 希釈 (濃いめ)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-500 text-[10.5px] font-bold mb-1">
                        {isSoil ? "使用量 (g または ml)" : "液肥原液の添加量 (ml)"}
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="200"
                        value={nutAmount}
                        onChange={(e) => setNutAmount(e.target.value)}
                        placeholder={isSoil ? "例: 10 (10gばらまき、または液肥10ml)" : "例: 4 (A液・B液を各4ml追加)"}
                        className="w-full px-3 py-1.5 text-base md:text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 text-[10.5px] font-bold mb-1">施肥・周辺環境のメモ</label>
                      <textarea 
                        value={nutNote}
                        onChange={(e) => setNutNote(e.target.value)}
                        placeholder={isSoil ? "株元から少し離れた土壌に5gずつ、指で軽く埋め込むように施して散水。" : "タンクに水を2L追加した後に、各原液を希釈しました。"}
                        className="w-full p-2.5 text-base md:text-xs bg-white border border-slate-200 rounded-lg text-slate-700 h-24 md:h-16 resize-y font-sans min-h-[85px]"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-sans rounded-xl transition-all shadow-xs"
                    >
                      {isSoil ? "施肥の記録を保存" : "施肥の記録を送信"}
                    </button>
                  </form>

                  {/* Nutrients logs history mapping logs */}
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      {isSoil ? "肥料・施肥・散布履歴" : "液肥施肥・散布履歴"} ({selectedPlant.nutrientLogs?.length || 0} 件)
                    </h3>

                    {(!selectedPlant.nutrientLogs || selectedPlant.nutrientLogs.length === 0) ? (
                      <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-xl text-xs border border-dashed border-slate-100">
                        {isSoil ? "まだ施肥・置き肥した記録履歴はありません。日々の栄養管理を記録しましょう。" : "まだ液肥の添加散布記録履歴はありません。水槽へ液肥を入れるたびに記録するとAIがそれを学習したアドバイスを行います。"}
                      </div>
                    ) : (
                      <>
                        {/* デスクトップ用テーブルビュー (md幅以上) */}
                        <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-xs">
                          <table className="w-full text-left text-xs text-slate-600 border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-mono uppercase">
                                <th className="p-3.5 font-bold">施肥日時</th>
                                <th className="p-3.5 font-bold">作業者</th>
                                <th className="p-3.5 font-bold">指定肥料・ブランド名</th>
                                <th className="p-3.5 font-bold text-center">希釈倍率</th>
                                <th className="p-3.5 font-bold text-center">使用量 (g / ml)</th>
                                <th className="p-3.5 font-bold">作業作業メモ</th>
                                <th className="p-3.5 font-bold text-center">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedPlant.nutrientLogs.map((log: any, index: number) => {
                                const dateShort = log.appliedAt ? log.appliedAt.split("T")[0] : "不明";
                                const canEdit = log.postedBy === user.id || selectedPlant.userId === user.id;



                                return (
                                  <tr key={log.id || index} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">{dateShort}</td>
                                    <td className="p-3.5 font-bold text-slate-700 whitespace-nowrap">{log.postedByName || "お手伝い"}</td>
                                    <td className="p-3.5 text-slate-800 font-medium whitespace-nowrap">{log.brand}</td>
                                    <td className="p-3.5 text-center font-mono font-bold whitespace-nowrap">
                                      {log.dilutionRate === 1 ? "希釈なし (置肥)" : `${log.dilutionRate} 倍`}
                                    </td>
                                    <td className="p-3.5 text-center font-mono font-bold text-indigo-700 whitespace-nowrap">
                                      {log.amountMl} {log.brand?.includes("緩効性") || log.brand?.includes("ばらまき") || log.brand?.includes("有機") ? "g" : "ml"}
                                    </td>
                                    <td className="p-3.5 text-slate-500 font-sans leading-relaxed">{log.note || "ー"}</td>
                                    <td className="p-3.5 text-center whitespace-nowrap">
                                      {canEdit ? (
                                        <div className="flex gap-2 justify-center">
                                          <button 
                                            type="button"
                                            onClick={() => startEditNutrientLog(log)}
                                            className="text-slate-450 hover:text-indigo-650 transition-colors cursor-pointer"
                                            title="編集"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={() => handleDeleteNutrientLogClick(log.id)}
                                            className="text-slate-450 hover:text-rose-600 transition-colors cursor-pointer"
                                            title="削除"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 font-mono">ー</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* モバイル用カードビュー (md幅未満) */}
                        <div className="space-y-3.5 md:hidden">
                          {selectedPlant.nutrientLogs.map((log: any, index: number) => {
                            const dateShort = log.appliedAt ? log.appliedAt.split("T")[0] : "不明";
                            const canEdit = log.postedBy === user.id || selectedPlant.userId === user.id;

                            return (
                              <div key={log.id || index} className="bg-white border border-slate-100 rounded-xl p-4.5 space-y-3.5 shadow-xs">
                                <div className="flex justify-between items-center text-[10.5px] text-slate-400 font-mono">
                                  <span className="font-bold flex items-center gap-1">📅 {dateShort}</span>
                                  <span className="font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">by {log.postedByName || "メンバー"}</span>
                                </div>
                                <div className="space-y-1.5">
                                  <h4 className="font-extrabold text-slate-800 text-xs flex justify-between items-center">
                                    <span>🧪 {log.brand}</span>
                                    <span className="text-indigo-650 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/40 font-mono">
                                      {log.amountMl} {log.brand?.includes("緩効性") || log.brand?.includes("ばらまき") || log.brand?.includes("有機") ? "g" : "ml"}
                                    </span>
                                  </h4>
                                  <p className="text-slate-550 leading-relaxed font-sans text-xs">
                                    {log.note || ""}
                                  </p>
                                </div>
                                <div className="pt-2 border-t border-slate-100/75 flex justify-between items-center text-[11px]">
                                  <span className="font-bold text-slate-400">
                                    倍率: {log.dilutionRate === 1 ? "原液" : `${log.dilutionRate}倍`}
                                  </span>
                                  {canEdit && (
                                    <div className="flex gap-3">
                                      <button 
                                        type="button" 
                                        onClick={() => startEditNutrientLog(log)} 
                                        className="text-indigo-650 font-bold hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                      >
                                        <Edit3 className="w-3 h-3" /> 編集
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => handleDeleteNutrientLogClick(log.id)} 
                                        className="text-rose-600 font-bold hover:text-rose-850 flex items-center gap-1 cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3" /> 削除
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                  </div>
                </div>
              </div>
            )}

            {/* 3. AI ADVISOR CHAT CONTEXT */}
            {activeTab === "ai" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                <div className="flex flex-col gap-6">
                  {/* AI Schedule Generation Card */}
                  <div className="border border-emerald-100 rounded-2xl p-5 bg-emerald-50/20 text-emerald-950 space-y-3.5 text-left shadow-2xs">
                    <h4 className="font-extrabold text-emerald-900 text-xs flex items-center gap-1.5 font-sans">
                      <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" /> AIスケジュール提案
                    </h4>
                    <p className="text-[11px] text-slate-650 leading-relaxed font-semibold font-sans">
                      栽培記録に基づいて、最適な<strong>水やり、施肥、害虫予防や収穫予測のスケジュール</strong>をAIで動的に追加生成します！
                    </p>
                    
                    <button 
                      type="button"
                      onClick={handleTriggerAISchedule}
                      disabled={generatingSchedule}
                      className="w-full sm:w-auto py-3 px-5 bg-emerald-600 hover:bg-emerald-750 active:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center sm:inline-flex gap-2"
                    >
                      <RefreshCcw className={`w-3.5 h-3.5 ${generatingSchedule ? "animate-spin" : ""}`} />
                      {generatingSchedule ? "スケジュール策定中..." : "AIスケジュール提案を実行"}
                    </button>
                  </div>

                  {/* Messages board */}
                  <div className="border border-slate-150 rounded-2xl flex flex-col h-[480px] bg-white shadow-xs overflow-hidden">
                    {/* Header bar */}
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center shrink-0">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-slate-500" /> AIチャット
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/15 min-h-0">
                      {/* Welcome message */}
                      <div className="flex items-start gap-3 max-w-[85%] text-left">
                        <div className="w-8 h-8 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          AI
                        </div>
                        <div className="p-3.5 bg-white border border-slate-200/70 rounded-2xl text-xs space-y-1.5 shadow-xs font-sans leading-relaxed">
                          <p className="font-extrabold text-slate-800 text-xs">
                            たねログAIアドバイザーです！ 🌱
                          </p>
                          <p className="text-slate-650 font-medium">
                            この植物の「種まき日」や「これまでの育成・お世話ログ」を自動で読み込んでいます。
                            「収穫はいつ頃？」「元気がない時はどうすればいい？」など、気になることを何でもお気軽にご相談くださいね！
                          </p>
                        </div>
                      </div>

                      {/* History list */}
                      {(selectedPlant.chatMessages || []).map((msg: any, idx: number) => {
                        const isUser = msg.sender === "user" || msg.postedBy === user.id;
                        return (
                          <div 
                            key={msg.id || idx} 
                            className={`flex items-start gap-3 max-w-[85%] text-left ${isUser ? "ml-auto flex-row-reverse" : ""}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                              isUser ? "bg-indigo-100 text-indigo-800" : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {isUser ? "栽培" : "AI"}
                            </div>
                            <div className={`p-3.5 rounded-2xl text-xs space-y-1 shadow-xs font-sans leading-relaxed whitespace-pre-wrap ${
                              isUser 
                                ? "bg-indigo-600 text-white font-extrabold rounded-tr-none" 
                                : "bg-white border border-slate-200/70 text-slate-750 font-medium rounded-tl-none"
                            }`}>
                              {msg.text || msg.message}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Chat form */}
                    <form onSubmit={handleChatSend} className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0">
                      <input 
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="（例）害虫が発生した時の対策や、収穫時期の目安は？"
                        disabled={sendingAi}
                        className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-base md:text-xs font-sans text-slate-750 focus:border-indigo-500 focus:outline-hidden disabled:opacity-50"
                      />
                      <button 
                        type="submit"
                        disabled={sendingAi || !aiPrompt.trim()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
                      >
                        {sendingAi ? "解析中..." : "質問する"}
                      </button>
                    </form>
                  </div>
                </div>

              </div>
            )}

            {/* 4. GROWTH SNAPSHOTS PHOTO ALBUM */}
            {activeTab === "photos" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/75 p-4.5 rounded-2xl border border-slate-100/80">
                  <div className="text-xs space-y-1 text-left">
                    <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5 font-sans">
                      <Camera className="w-4 h-4 text-emerald-600 animate-pulse" />
                      成長写真アルバム (Photo Gallery)
                    </h4>
                    <p className="text-slate-500 font-sans leading-relaxed">
                      栽培・水質測定のログに添付された測定スナップ画像をリストアップします。アルバムのトップから見たい画像をクリックすると、詳細ダイアログからその測定日に投稿されたログ（pH値や液肥の記録など）へ直接ジャンプ可能です。
                    </p>
                  </div>
                </div>

                {(() => {
                  const photoLogs = (selectedPlant.growLogs || []).filter((log: any) => log.imageUrl);
                  if (photoLogs.length === 0) {
                    return (
                      <div className="py-16 border border-dashed border-slate-200 rounded-3xl text-center bg-slate-50/20 text-slate-400 select-none">
                        <Camera className="w-12 h-12 mx-auto opacity-30 mb-3 text-emerald-600/70" />
                        <p className="text-xs font-bold leading-relaxed max-w-md mx-auto">
                          登録されている成長写真はありません。<br />
                          <span className="text-emerald-700 font-extrabold">「栽培記録」タブ</span>から、新しく写真を撮影またはアップロードしたログを保存すると、このアルバムへ自動でスタイリッシュに集約されます！
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {photoLogs.map((log: any, index: number) => {
                        const dateStr = log.loggedAt ? log.loggedAt.split("T")[0] : "不明";
                        return (
                          <div 
                            key={log.id || index}
                            onClick={() => setSelectedPhotoLog(log)}
                            className="group aspect-square rounded-2xl overflow-hidden border border-slate-150 bg-slate-900 relative cursor-pointer shadow-2xs hover:shadow-lg hover:border-emerald-500/50 transition-all duration-300"
                          >
                            <img 
                              src={log.imageUrl} 
                              alt={log.note || `成長スナップ ${dateStr}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-350 ease-out group-hover:scale-105"
                            />
                            {/* Hover dark overlay banner styled stylishly */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent h-14 flex flex-col justify-end p-3 text-left">
                              <p className="text-[10px] font-mono font-bold text-slate-300">{dateStr}</p>
                              <p className="text-[10.5px] font-sans font-bold text-white truncate max-w-full">
                                {log.note || ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 5. SETTINGS TAB */}
            {activeTab === "settings" && (
              <div className="space-y-6 animate-in fade-in duration-200 text-left font-sans">
                
                {/* 共同栽培・共有設定へのリンクカード */}
                <div id="planter-coop-link-card" className="border border-teal-150 rounded-2xl p-6 bg-gradient-to-br from-teal-50/35 to-emerald-50/20 space-y-4 font-sans shadow-2xs">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-teal-500/10 rounded-xl text-teal-700 shrink-0 mt-0.5">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 text-left flex-1 font-sans">
                      <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 leading-none">
                        共同栽培・共有（お手伝い）設定
                        <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-100/50 px-2 py-0.5 rounded-full font-extrabold">
                          プランター単位
                        </span>
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-sans mt-2">
                        共有やお手伝い管理は、個々の植物ごとではなく<strong>プランター（栽培環境・鉢）単位</strong>で行います。<br />
                        この植物が育てられているプランター「<span className="font-extrabold text-teal-800">{selectedPlant.system?.name || "ハイドロプランター"}</span>」の共同栽培画面を開いて、新メンバーの招待、既存メンバーの割当や退出設定を行うことができます。
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        // 親プランター設定を開く
                        setActiveSystemSettingsId(selectedPlant.systemId);
                        // 植物詳細画面を閉じる（プランター設定と同時に一覧へバックするため）
                        onSelectPlant(null);
                      }}
                      className="px-4.5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer font-sans"
                    >
                      <span>👥 このプランターの共同設定へ進む</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div id="planter-profile-settings-panel" className="border border-slate-150 rounded-2xl p-6 bg-slate-50/50 space-y-4 font-sans">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 font-sans">
                    <Settings className="w-4 h-4 text-slate-550" />
                    植物管理設定
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    「{selectedPlant.name}」に関するステータスの変更や、データの削除を行うことができます。
                  </p>

                  <div className="border-t border-slate-150/40 pt-5 space-y-5">
                    {/* Archiving section */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-slate-100 rounded-xl">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-sans">
                          <span>📦</span> 植物の栽培完了
                        </h4>
                        <p className="text-[11px] text-slate-450 leading-relaxed font-medium font-sans">
                          栽培中のリストから非表示にし、栽培完了履歴に保存します。
                        </p>
                      </div>
                      <button 
                        onClick={async () => {
                          const toArchived = !selectedPlant.archived;
                          requestConfirm(
                            toArchived ? "植物のアーカイブ" : "アーカイブから復元",
                            toArchived 
                              ? "この植物を栽培完了として保存しますか？\n栽培リストから非表示になり、栽培完了履歴として閲覧・管理できるようになります。" 
                              : "この植物を通常栽培エリアへ復元しますか？\n再びアクティブな栽培リストへ戻り、日々の潅水や測定ログ管理を再開できます。",
                            async () => {
                              await onUpdatePlant(selectedPlant.id, { archived: toArchived, stage: toArchived ? "finished" : "vegetative" });
                              onSelectPlant(selectedPlant.id);
                            }
                          );
                        }}
                        className={`sm:w-auto w-full px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:scale-[1.01] transition-all rounded-xl cursor-pointer border shrink-0 ${
                          selectedPlant.archived 
                            ? "text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100" 
                            : "text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100"
                        }`}
                      >
                        <span>📦</span>
                        {selectedPlant.archived ? "通常エリアに復元" : "栽培完了にする"}
                      </button>
                    </div>

                    {/* Deletion section */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-rose-50/20 border border-rose-100 rounded-xl">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5 font-sans">
                          <Trash2 className="w-3.5 h-3.5" /> 栽培プロファイルの完全削除
                        </h4>
                        <p className="text-[11px] text-rose-700/70 leading-relaxed font-semibold font-sans">
                          この植物のプロファイルとすべての栽培記録をシステムから削除します。
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          requestConfirm(
                            "栽培プロファイルの完全削除",
                            "この植物の栽培データを本当に完全に削除しますか？\nこれまでの栽培記録、登録した写真、およびAIスケジュールを含むすべてのデータが完全に消去され、復元することは一切できません。",
                            () => {
                              onDeletePlant(selectedPlant.id);
                            }
                          );
                        }}
                        className="sm:w-auto w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        削除する
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 成長測定履歴 (GrowLog) 編集モーダル */}
        {editingGrowLogId && (
          <div 
            className="fixed inset-0 z-[990] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans"
          onClick={() => setEditingGrowLogId(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[calc(100vh-3rem)] flex flex-col relative animate-in fade-in zoom-in-95 duration-150 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 固定ヘッダー */}
            <div className="flex justify-between items-center p-6 pb-4 border-b border-indigo-100 shrink-0">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <span className="text-indigo-650">📊</span> 測定・観察履歴の編集
              </h3>
              <button 
                type="button"
                onClick={() => setEditingGrowLogId(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* スクロール可能なコンテンツエリア */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 min-h-0 text-xs text-slate-705">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                    📅 測定日時
                  </label>
                  <input 
                    type="date" 
                    value={editGrowLoggedAt} 
                    onChange={(e) => setEditGrowLoggedAt(e.target.value)} 
                    className="w-full max-w-[130px] text-base md:text-sm p-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden font-sans transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 md:pt-6">
                  <label className="flex items-center gap-2.5 p-2 bg-indigo-50/40 hover:bg-indigo-50 border border-indigo-100/30 rounded-lg w-full cursor-pointer transition-colors select-none">
                    <input 
                      type="checkbox" 
                      id="editGrowWatered-modal"
                      checked={editGrowWatered} 
                      onChange={(e) => setEditGrowWatered(e.target.checked)} 
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />
                    <span className="text-xs text-slate-700 font-extrabold cursor-pointer">水やりを実施した（お世話マーク）</span>
                  </label>
                </div>
              </div>

              {user.showPhEc !== false ? (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">🧪 pH値</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="1"
                      max="12"
                      value={editGrowPh} 
                      onChange={(e) => setEditGrowPh(e.target.value)} 
                      placeholder="pH"
                      className="w-full text-base md:text-sm p-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden text-center font-mono transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-500 mb-1 font-sans">⚡ EC値（mS/cm）</label>
                    <input 
                      type="number" 
                      step="0.05"
                      min="0"
                      max="5"
                      value={editGrowEc} 
                      onChange={(e) => setEditGrowEc(e.target.value)} 
                      placeholder="EC"
                      className="w-full text-base md:text-sm p-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden text-center font-mono transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-500 mb-1 font-sans">🌡️ 気温（℃）</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="40"
                      value={editGrowWaterTemp} 
                      onChange={(e) => setEditGrowWaterTemp(e.target.value)} 
                      placeholder="気温"
                      className="w-full text-base md:text-sm p-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden text-center font-mono transition-all"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1">
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-500 mb-1 font-sans">🌡️ 地温・気温（℃）</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="40"
                      value={editGrowWaterTemp} 
                      onChange={(e) => setEditGrowWaterTemp(e.target.value)} 
                      placeholder="温度"
                      className="w-full text-base md:text-sm p-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden text-center font-mono transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">📝 観察メモ・日々の変化</label>
                <textarea 
                  value={editGrowNote} 
                  onChange={(e) => setEditGrowNote(e.target.value)} 
                  placeholder="新芽が出た、根がよく伸びている、葉の色が薄い、などの気づきを記録しましょう。"
                  rows={4}
                  className="w-full text-base md:text-sm p-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden min-h-[120px] h-auto resize-y font-sans transition-all leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                  📸 添付写真 (複数可・任意)
                </label>
                {editGrowPhotoBase64s.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {editGrowPhotoBase64s.map((b64, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-1">
                        <img src={b64} alt={`ログ添付画像 ${idx + 1}`} className="w-full h-24 object-cover rounded-md font-sans text-xs" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setEditGrowPhotoBase64s((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1.5 right-1.5 bg-slate-900/75 hover:bg-slate-900 text-white rounded-full p-1.5 transition-colors cursor-pointer flex items-center justify-center shadow-xs"
                          title="写真を削除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/20 rounded-xl py-6 px-4 hover:bg-slate-50 cursor-pointer transition-all text-center select-none group">
                    <Camera className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 mb-1.5 transition-colors" />
                    <span className="text-xs font-bold text-indigo-600">
                      {editGrowPhotoBase64s.length > 0 ? "写真をさらに撮影・追加する" : "状況写真を撮影・添付する"}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">タップしてカメラ起動・画像選択 (複数可)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files) return;
                        Array.from(files).forEach((file: any) => {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEditGrowPhotoBase64s((prev) => [...prev, reader.result as string]);
                          };
                          reader.readAsDataURL(file);
                        });
                      }}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* 固定フッター */}
            <div className="flex gap-2.5 p-6 pt-4 border-t border-slate-100 shrink-0">
              <button 
                type="button" 
                onClick={handleUpdateGrowLogSubmit} 
                className="flex-1 py-3 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition-all cursor-pointer text-center font-sans shadow-sm"
              >
                編集内容を保存する
              </button>
              <button 
                type="button" 
                onClick={() => setEditingGrowLogId(null)} 
                className="py-3 px-5 text-xs font-extrabold text-slate-600 bg-white hover:bg-slate-50 border border-slate-250 rounded-lg transition-colors cursor-pointer text-center font-sans"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 施肥履歴 (NutrientLog) 編集モーダル */}
      {editingNutrientLogId && (
        <div 
          className="fixed inset-0 z-[990] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans"
          onClick={() => setEditingNutrientLogId(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[calc(100vh-3rem)] flex flex-col relative animate-in fade-in zoom-in-95 duration-150 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 固定ヘッダー */}
            <div className="flex justify-between items-center p-6 pb-4 border-b border-indigo-100 shrink-0">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <span className="text-indigo-650">🧪</span> 施肥・栄養追加履歴の編集
              </h3>
              <button 
                type="button"
                onClick={() => setEditingNutrientLogId(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* スクロール可能なコンテンツエリア */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 min-h-0 text-xs text-slate-705">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                    📅 施肥日時
                  </label>
                  <input 
                    type="date" 
                    value={editNutrientAppliedAt} 
                    onChange={(e) => setEditNutrientAppliedAt(e.target.value)} 
                    className="w-full max-w-[130px] text-base md:text-sm p-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden font-sans transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-1">
                    🧪 ブランド/肥料・サプリ名
                  </label>
                  <input 
                    type="text" 
                    value={editNutrientBrand} 
                    onChange={(e) => setEditNutrientBrand(e.target.value)} 
                    placeholder="ハイポニカ液体肥料 (A液+B液) など"
                    className="w-full text-base md:text-sm p-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden font-sans font-medium transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-1">💧 希釈倍率</label>
                  <select 
                    value={editNutrientDilution} 
                    onChange={(e) => setEditNutrientDilution(e.target.value)} 
                    className="w-full text-base md:text-sm p-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden cursor-pointer transition-all"
                  >
                    <option value="1">希釈なし (置肥/直撒き)</option>
                    <option value="250">250倍希釈</option>
                    <option value="500">500倍希釈 (標準)</option>
                    <option value="1000">1000倍希釈</option>
                    <option value="2000">2000倍希釈</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-1">⚖️ 使用量</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="1"
                      value={editNutrientAmount} 
                      onChange={(e) => setEditNutrientAmount(e.target.value)} 
                      className="w-full text-base md:text-sm p-2.5 pr-12 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden font-mono text-center transition-all"
                    />
                    <span className="absolute right-3.5 text-xs font-bold text-slate-400 top-1/2 -translate-y-1/2 select-none">
                      {editNutrientBrand?.includes("緩効性") || editNutrientBrand?.includes("ばらまき") || editNutrientBrand?.includes("有機") ? "g" : "ml"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">📝 施肥・手入れ作業メモ</label>
                <textarea 
                  value={editNutrientNote} 
                  onChange={(e) => setEditNutrientNote(e.target.value)} 
                  placeholder="施肥時に行った他の作業（剪定、溶液 of 全交換など）も合わせて記録しておくと便利です。"
                  rows={4}
                  className="w-full text-base md:text-sm p-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-hidden min-h-[120px] h-auto resize-y font-sans transition-all leading-relaxed"
                />
              </div>
            </div>

            {/* 固定フッター */}
            <div className="flex gap-2.5 p-6 pt-4 border-t border-slate-100 shrink-0">
              <button 
                type="button" 
                onClick={handleUpdateNutrientLogSubmit} 
                className="flex-1 py-3 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition-all cursor-pointer text-center font-sans shadow-sm"
              >
                編集内容を保存する
              </button>
              <button 
                type="button" 
                onClick={() => setEditingNutrientLogId(null)} 
                className="py-3 px-5 text-xs font-extrabold text-slate-600 bg-white hover:bg-slate-50 border border-slate-250 rounded-lg transition-colors cursor-pointer text-center font-sans"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 成長アルバム拡大表示モーダル */}
      <AnimatePresence>
        {selectedPhotoLog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[990] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs font-sans overflow-hidden select-none"
            onClick={() => setSelectedPhotoLog(null)}
          >
            {/* カードの位置・サイズを一貫させるための相対配置コンテナー */}
            <div 
              className="relative w-full max-w-lg h-[calc(100vh-4rem)] max-h-[620px] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 内部切り替え用の AnimatePresence */}
              <AnimatePresence initial={false} custom={swipeDirection} mode="popLayout">
                <motion.div 
                  key={`${selectedPhotoLog.id}-${activePhotoSubIndex}`}
                  custom={swipeDirection}
                  variants={{
                    enter: (direction: number) => ({
                      x: direction > 0 ? "100%" : direction < 0 ? "-100%" : 0,
                      opacity: 0,
                    }),
                    center: {
                      x: 0,
                      opacity: 1,
                      transition: {
                        x: { type: "spring", stiffness: 300, damping: 28 },
                        opacity: { duration: 0.2 }
                      }
                    },
                    exit: (direction: number) => ({
                      x: direction > 0 ? "-100%" : direction < 0 ? "100%" : 0,
                      opacity: 0,
                      transition: {
                        x: { type: "spring", stiffness: 300, damping: 28 },
                        opacity: { duration: 0.2 }
                      }
                    })
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.65}
                  onDragEnd={(event, info) => {
                    const swipeThreshold = 55;
                    if (info.offset.x < -swipeThreshold) {
                      handleNextPhoto();
                    } else if (info.offset.x > swipeThreshold) {
                      handlePrevPhoto();
                    }
                  }}
                  className="absolute inset-0 bg-white rounded-2xl shadow-2xl flex flex-col text-left cursor-grab active:cursor-grabbing w-full h-full overflow-hidden"
                >
                  {/* 固定ヘッダー */}
                  <div className="flex justify-between items-center p-6 py-4 border-b border-light-150 shrink-0">
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <span className="text-indigo-650">📸</span> 成長スナップ詳細
                    </h3>
                    <button 
                      type="button"
                      onClick={() => setSelectedPhotoLog(null)}
                      className="text-slate-400 hover:text-slate-600 transition-colors text-lg font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* スクロール可能なコンテンツエリア */}
                  <div className="p-6 overflow-y-auto space-y-4 flex-1 min-h-0 text-slate-700 relative">
                    {/* Image with Left/Right arrow overlay buttons */}
                    {(() => {
                      // 複数画像の配列を取得
                      const currentImages = selectedPhotoLog.imageUrls && selectedPhotoLog.imageUrls.length > 0
                        ? selectedPhotoLog.imageUrls
                        : (selectedPhotoLog.imageUrl ? [selectedPhotoLog.imageUrl] : []);
                      const currentImgUrl = currentImages[activePhotoSubIndex] || selectedPhotoLog.imageUrl;

                      return (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200/60 bg-slate-950 flex items-center justify-center h-[35vh] max-h-[260px] group select-none shrink-0">
                          <img 
                            src={currentImgUrl} 
                            alt="成長スナップ" 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain pointer-events-none"
                          />

                          {/* 写真切替表示ドット（インジケーター） */}
                          {currentImages.length > 1 && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-slate-900/65 px-2.5 py-1 rounded-full z-10">
                              {currentImages.map((_, i) => (
                                <span 
                                  key={i} 
                                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === activePhotoSubIndex ? 'bg-emerald-400 scale-110' : 'bg-slate-400/60'}`}
                                />
                              ))}
                            </div>
                          )}

                          {/* Left/Right Arrow Navigation Buttons */}
                          {(currentImages.length > 1 || (selectedPlant?.growLogs || []).filter((log: any) => log.imageUrl || (log.imageUrls && log.imageUrls.length > 0)).length > 1) && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrevPhoto();
                                }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-slate-900/65 hover:bg-slate-900/85 text-white transition-all cursor-pointer shadow-xs active:scale-95 border border-white/10"
                                aria-label="前の写真"
                              >
                                ◀
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNextPhoto();
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-slate-900/65 hover:bg-slate-900/85 text-white transition-all cursor-pointer shadow-xs active:scale-95 border border-white/10"
                                aria-label="次の写真"
                              >
                                ▶
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    <div className="space-y-3.5 pt-1 text-xs">
                      <div className="flex justify-between items-center text-[10.5px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1 font-bold">📅 測定日時: {selectedPhotoLog.loggedAt ? selectedPhotoLog.loggedAt.split("T")[0] : "不明"}</span>
                        <span className="font-extrabold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">お手伝い: {selectedPhotoLog.postedByName || "メンバー"}</span>
                      </div>

                      {/* pH, EC indicators inside modal */}
                      <div className="flex flex-wrap gap-2">
                        {selectedPhotoLog.ph && (
                          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-extrabold rounded-lg border border-emerald-100 flex items-center gap-1">
                            <span>🧪</span> pH {selectedPhotoLog.ph}
                          </div>
                        )}
                        {selectedPhotoLog.ec && (
                          <div className="px-3 py-1.5 bg-indigo-50 text-indigo-800 text-xs font-extrabold rounded-lg border border-indigo-100 flex items-center gap-1">
                            <span>⚡</span> EC {selectedPhotoLog.ec}
                          </div>
                        )}
                        {selectedPhotoLog.waterTemp && (
                          <div className="px-3 py-1.5 bg-sky-50 text-sky-800 text-xs font-extrabold rounded-lg border border-sky-100 flex items-center gap-1 font-sans">
                            <span>🌡️</span> 気温 {selectedPhotoLog.waterTemp}℃
                          </div>
                        )}
                        {selectedPhotoLog.watered && (
                          <div className="px-3 py-1.5 bg-teal-50 text-teal-800 text-xs font-extrabold rounded-lg border border-teal-100 flex items-center gap-1">
                            <span>💧</span> 水やり実施済
                          </div>
                        )}
                      </div>

                      {/* 観察メモの記述 */}
                      {selectedPhotoLog.note && (
                        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-slate-600 leading-relaxed font-sans text-xs">
                          <p className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                            <span>📝</span> 観察記録メモ
                          </p>
                          <p className="whitespace-pre-wrap">{selectedPhotoLog.note}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 固定フッター */}
                  <div className="flex gap-2.5 p-6 py-4 border-t border-slate-100 shrink-0">
                    <button 
                      type="button" 
                      onClick={() => {
                        const logId = selectedPhotoLog.id;
                        setSelectedPhotoLog(null);
                        handleGoToLog(logId);
                      }} 
                      className="flex-1 py-3 px-4 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all cursor-pointer text-center font-sans shadow-xs flex items-center justify-center gap-2 group"
                    >
                      🔍 この測定・観察記録のログ位置へ進む
                      <span className="transform group-hover:translate-x-1 transition-transform font-bold font-sans">➔</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setSelectedPhotoLog(null)} 
                      className="py-3 px-5 text-xs font-extrabold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer text-center font-sans"
                    >
                      閉じる
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* カスタム確認ダイアログモーダル */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full border border-slate-100 text-left space-y-4"
            >
              <div className="flex items-center gap-3 text-slate-800 font-extrabold text-sm">
                <span className="text-emerald-605 text-lg">🌱</span>
                <h3>{confirmTitle || "よろしいですか？"}</h3>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">
                {confirmMessage}
              </p>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmAction?.run) {
                      confirmAction.run();
                    }
                    setShowConfirm(false);
                    setConfirmAction(null);
                  }}
                  className="flex-1 py-2 px-4 bg-emerald-650 hover:bg-emerald-700 bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                >
                  実行する
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmAction(null);
                  }}
                  className="py-2 px-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-xs border border-slate-205 rounded-xl transition-colors cursor-pointer text-center"
                >
                  キャンセル
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
