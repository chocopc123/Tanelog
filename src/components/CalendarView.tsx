import React, { useState } from "react";
import { ScheduleProposal, ProposalStatus, isSoilSystem } from "../types";
import { 
  Calendar, ChevronLeft, ChevronRight, Download, Check, X, Clock, HelpCircle, AlertCircle, Pencil, Plus
} from "lucide-react";

interface CalendarViewProps {
  proposals: any[]; // Hydrated proposals with plantName
  onApproveProposal: (id: string, status: ProposalStatus, approvedDate?: string, type?: string, note?: string) => void;
  onCreateProposal: (plantId: string, type: string, proposedDate: string, note: string) => Promise<void>;
  userToken: string;
  plants: any[];
  systems?: any[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  proposals,
  onApproveProposal,
  onCreateProposal,
  userToken,
  plants,
  systems = []
}) => {
  // Current calendar date state
  const [currentDate, setCurrentDate] = useState<Date>(new Date("2026-06-03")); // Seed matching current local time metadata
  const [filter, setFilter] = useState<"all" | "approved" | "completed">("all");
  const [listStatusTab, setListStatusTab] = useState<"pending_approved" | "completed" | "all">("pending_approved");
  const [listDateFilter, setListDateFilter] = useState<string>("2026-06");

  // Edit states for proposals
  const [editingProposal, setEditingProposal] = useState<any | null>(null);
  const [editType, setEditType] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");

  // Add states for manual proposal creation
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addPlantId, setAddPlantId] = useState("");
  const [addType, setAddType] = useState("watering");
  const [addDate, setAddDate] = useState("");
  const [addNote, setAddNote] = useState("");

  const isSoilProposal = (plantId: string) => {
    const plant = (plants || []).find(p => p.id === plantId);
    if (!plant) return false;
    const sys = (systems || []).find(s => s.id === plant.systemId);
    if (!sys) return false;
    return isSoilSystem(sys.type);
  };

  const startEditingProposal = (proposal: any) => {
    setEditingProposal(proposal);
    setEditType(proposal.type);
    setEditDate(proposal.proposedDate);
    setEditNote(proposal.note);
  };

  const handleSaveEdit = async () => {
    if (!editingProposal) return;
    await onApproveProposal(editingProposal.id, editingProposal.status, editDate, editType, editNote);
    setEditingProposal(null);
  };

  const handleOpenAddModal = (dateObj?: Date) => {
    const activePlants = (plants || []).filter(p => !p.archived);
    if (activePlants.length > 0) {
      setAddPlantId(activePlants[0].id);
    } else {
      setAddPlantId("");
    }
    setAddType("watering");
    
    // Set standard default date (either clicked date or current system local time)
    const targetDate = dateObj ? formatDateToYYYYMMDD(dateObj) : formatDateToYYYYMMDD(new Date("2026-06-03"));
    setAddDate(targetDate);
    setAddNote("");
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = async () => {
    if (!addPlantId) {
      alert("対象の植物を選択してください。");
      return;
    }
    if (!addDate) {
      alert("実施予定日を入力してください。");
      return;
    }
    await onCreateProposal(addPlantId, addType, addDate, addNote);
    setIsAddModalOpen(false);
  };

  const activePlantIds = (plants || []).filter(p => !p.archived).map(p => p.id);
  const activeProposals = proposals.filter(p => activePlantIds.includes(p.plantId));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar days
  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1...
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (Date | null)[] = [];
  // Fill nulls for previous month offset
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  // Fill actual days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    // Generate actual Date object in local time
    calendarDays.push(new Date(year, month, day));
  }

  const formatDateToYYYYMMDD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Group events by day
  const getEventsForDate = (date: Date) => {
    const dStr = formatDateToYYYYMMDD(date);
    return activeProposals.filter(p => {
      // Format match of proposal YYYY-MM-DD
      const propDStr = p.proposedDate;
      if (propDStr !== dStr) return false;
      
      if (filter === "all") return true;
      return p.status === filter;
    });
  };

  // Download iCal handler
  const handleExportICal = () => {
    // Navigate directly using native click download
    const url = `/api/calendar/export?token=${encodeURIComponent(userToken)}`;
    window.open(url, "_blank");
  };

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  // Colors mapping
  const getTypeStyles = (type: string, status: string, plantId?: string) => {
    if (type === "nutrient") {
      return {
        bg: "bg-indigo-50 border border-indigo-100",
        text: "text-indigo-800",
        badge: "bg-indigo-500",
        label: "🧪 追肥"
      };
    } else if (type === "water_change") {
      return {
        bg: "bg-amber-50 border border-amber-100",
        text: "text-amber-800",
        badge: "bg-amber-500",
        label: "💧 水やり・水換え"
      };
    } else if (type === "ph_check") {
      return {
        bg: "bg-teal-50 border border-teal-100",
        text: "text-teal-800",
        badge: "bg-teal-500",
        label: "📊 測定・確認"
      };
    } else if (type === "harvest") {
      return {
        bg: "bg-emerald-50 border border-emerald-100",
        text: "text-emerald-800",
        badge: "bg-emerald-600",
        label: "✂️ 収穫"
      };
    } else if (type === "watering") {
      return {
        bg: "bg-blue-50 border border-blue-100",
        text: "text-blue-800",
        badge: "bg-blue-500",
        label: "💧 水やり"
      };
    } else if (type === "pruning") {
      return {
        bg: "bg-rose-50 border border-rose-100",
        text: "text-rose-800",
        badge: "bg-rose-550",
        label: "✂️ 剪定・芽かき"
      };
    } else if (type === "weeding_aeration") {
      return {
        bg: "bg-amber-50 border border-amber-100",
        text: "text-amber-800",
        badge: "bg-amber-550",
        label: "🌱 草取り・中耕"
      };
    }

    return {
      bg: "bg-slate-100 border border-slate-200",
      text: "text-slate-700",
      badge: "bg-slate-400",
      label: "🌱 タスク"
    };
  };

  const listFilteredProposals = activeProposals.filter(p => {
    // 1. ステータスフィルター (未完了 vs 完了済み vs すべて)
    const isApproved = p.status === "approved" || p.status === "pending";
    if (listStatusTab === "pending_approved") {
      if (!isApproved) return false;
    } else if (listStatusTab === "completed") {
      if (p.status !== "completed") return false;
    }

    // 2. 予定月フィルター (月が指定されている場合のみ適用)
    if (listDateFilter) {
      if (!p.proposedDate.startsWith(listDateFilter)) return false;
    }

    return true;
  }).sort((a, b) => {
    // 予定日の昇順でソート（日付が近い順・古い順に表示してスケジュールを管理しやすくする）
    return a.proposedDate.localeCompare(b.proposedDate);
  });

  return (
    <div id="calendar-view-container" className="space-y-6">
      
      {/* Header */}
      <div id="calendar-header-bar" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" /> 
          栽培計画・お世話スケジュール
        </h2>
        <p className="text-slate-500 text-xs mt-1 leading-relaxed">
          栽培計画や日々のお世話スケジュールを管理します。
        </p>
      </div>

      {/* Tabs list filter and simple explanation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter buttons */}
        <div className="bg-slate-100 p-1 rounded-xl inline-flex text-xs font-sans">
          <button 
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filter === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
          >
            すべて表示
          </button>
          <button 
            onClick={() => setFilter("approved")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filter === "approved" ? "bg-white text-emerald-750 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
          >
            実施予定
          </button>
          <button 
            onClick={() => setFilter("completed")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filter === "completed" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
          >
            完了済み
          </button>
        </div>

        {/* Legend */}
        <div id="calendar-legends" className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-500 block"></span> 🧪 追肥</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500 block"></span> 💧 水やり・水換え</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-teal-500 block"></span> 📊 測定・確認</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-600 block"></span> ✂️ 収穫</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500 block"></span> ✂️ 剪定・芽かき</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* BIG MONTHLY GRID CALENDAR */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between">
          
          <div>
            {/* Month Controller */}
            <div className="flex items-center justify-between mb-5">
              <button 
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-base font-extrabold text-slate-800">
                {year}年 {month + 1}月
              </div>
              <button 
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-1 text-center font-sans mb-1">
              {weekdays.map((w, idx) => (
                <div 
                  key={idx} 
                  className={`text-xs font-bold py-2 ${idx === 0 ? "text-rose-600" : idx === 6 ? "text-blue-600" : "text-slate-400"}`}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Month Days grid */}
            <div className="grid grid-cols-7 gap-1 mt-1 flex-1">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="bg-slate-50/30 rounded-xl min-h-[90px] border border-dashed border-slate-100"></div>;
                }

                const events = getEventsForDate(day);
                const isToday = formatDateToYYYYMMDD(new Date()) === formatDateToYYYYMMDD(day);

                return (
                  <div 
                    key={`day-${day.getDate()}`} 
                    onClick={() => handleOpenAddModal(day)}
                    className={`bg-white rounded-xl min-h-[95px] p-2 border transition-all flex flex-col justify-between cursor-pointer group ${
                      isToday 
                        ? "border-emerald-500 shadow-xs ring-4 ring-emerald-50" 
                        : "border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/10"
                    }`}
                    title="クリックしてこの日に予定を追加🌱"
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-extrabold font-sans ${
                        day.getDay() === 0 ? "text-rose-500" : day.getDay() === 6 ? "text-blue-500" : "text-slate-700"
                      }`}>
                        {day.getDate()}
                      </span>
                      <div className="flex items-center gap-1">
                        {isToday && (
                          <span className="text-[8px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded-full scale-90">TODAY</span>
                        )}
                        <span>
                          <Plus className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                    </div>

                    {/* Day Events stack */}
                    <div className="space-y-1 mt-1 flex-1 flex flex-col justify-end">
                      {events.slice(0, 3).map((ev, eIdx) => {
                        const styles = getTypeStyles(ev.type, ev.status, ev.plantId);
                        return (
                          <div 
                            key={ev.id || eIdx} 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent launching the general creation popup
                              startEditingProposal(ev);
                            }}
                            className={`text-[8.5px] px-1 py-0.5 rounded border leading-tight truncate font-sans font-semibold hover:scale-[1.03] transition-transform ${styles.bg} ${styles.text}`}
                            title={`[${ev.plantName}] ${ev.note}\n(クリックで編集/消去)`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${styles.badge}`}></span>
                            {styles.label}: {ev.plantName}
                          </div>
                        );
                      })}
                      {events.length > 3 && (
                        <div className="text-[7.5px] text-slate-400 font-bold font-mono text-center">
                          他 {events.length - 3} 件
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* LIST DETAILS PANEL */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col h-full min-h-[520px]">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-2">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              お世話スケジュール一覧
            </h3>
            <button 
              onClick={() => handleOpenAddModal()}
              className="text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" /> 新規登録
            </button>
          </div>

          {/* List specific tabs (未完了 vs 完了済み vs すべて) */}
          <div className="mt-3 bg-slate-100 p-1 rounded-xl flex text-xs font-sans select-none">
            <button 
              type="button"
              onClick={() => setListStatusTab("pending_approved")}
              className={`flex-1 text-center py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                listStatusTab === "pending_approved" ? "bg-white text-emerald-750 shadow-3xs" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              未完了
            </button>
            <button 
              type="button"
              onClick={() => setListStatusTab("completed")}
              className={`flex-1 text-center py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                listStatusTab === "completed" ? "bg-white text-blue-750 shadow-3xs" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              完了済み
            </button>
            <button 
              type="button"
              onClick={() => setListStatusTab("all")}
              className={`flex-1 text-center py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                listStatusTab === "all" ? "bg-white text-slate-800 shadow-3xs" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              すべて
            </button>
          </div>

          {/* Month Filter (予定月によるフィルター) */}
          <div className="mt-3 p-2.5 bg-slate-50/70 rounded-xl border border-slate-100/60 flex flex-col gap-1.5">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">📅 予定月によるフィルター</span>
            <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  let baseMonth = listDateFilter || "2026-06";
                  const [y, m] = baseMonth.split("-").map(Number);
                  const d = new Date(y, m - 2, 1);
                  const prevMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  setListDateFilter(prevMonth);
                }}
                className="p-1 hover:bg-slate-100 rounded text-slate-650 cursor-pointer flex items-center justify-center transition-colors border border-slate-100"
                title="前月"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>

              <span className="text-xs font-bold text-slate-700 min-w-[90px] text-center select-none">
                {(() => {
                  const baseMonth = listDateFilter || "2026-06";
                  const [y, m] = baseMonth.split("-");
                  return `${y}年 ${Number(m)}月`;
                })()}
              </span>

              <button
                type="button"
                onClick={() => {
                  let baseMonth = listDateFilter || "2026-06";
                  const [y, m] = baseMonth.split("-").map(Number);
                  const d = new Date(y, m, 1);
                  const nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  setListDateFilter(nextMonth);
                }}
                className="p-1 hover:bg-slate-100 rounded text-slate-650 cursor-pointer flex items-center justify-center transition-colors border border-slate-100"
                title="翌月"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3">
            {listFilteredProposals.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-xs">
                該当するスケジュール予定はありません。
              </div>
            ) : (
              listFilteredProposals.map((item, idx) => {
                const styles = getTypeStyles(item.type, item.status, item.plantId);
                const isApproved = item.status === "approved" || item.status === "pending"; // treat pending as directly approved

                return (
                  <div 
                    key={item.id || idx} 
                    className="p-3.5 rounded-xl border flex flex-col justify-between gap-2 transition-all bg-slate-50/50 border-slate-100 hover:border-slate-200"
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start gap-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.status === "completed" 
                            ? "bg-blue-100 text-blue-800 font-extrabold" 
                            : isApproved 
                            ? "bg-emerald-100 text-emerald-800" 
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {item.status === "completed" ? "実施完了" : isApproved ? "実施予定" : "削除済/却下済"}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">予定日: {item.proposedDate}</span>
                      </div>

                      <div className="text-xs font-bold text-slate-800">
                        {styles.label} - {item.plantName}
                      </div>

                      <p className={`text-[11px] text-slate-600 leading-relaxed font-sans ${item.status === 'completed' ? 'line-through text-slate-400 opacity-60' : ''}`}>{item.note}</p>
                    </div>

                    {isApproved && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100/40">
                        <button 
                          onClick={() => startEditingProposal(item)}
                          className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-0.5 transition-colors cursor-pointer mr-auto"
                        >
                          <Pencil className="w-3 h-3" /> 編集
                        </button>
                        <button 
                          onClick={() => onApproveProposal(item.id, "dismissed")}
                          className="px-2 py-1 text-[10px] font-bold text-rose-600 bg-rose-50/55 hover:bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-0.5 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" /> 消去
                        </button>
                        <button 
                          onClick={() => onApproveProposal(item.id, "completed")}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-0.5 transition-colors shadow-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> 完了にする
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* エクスポートボタンを最下部に設置 */}
      <div id="calendar-export-footer" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-700">外部カレンダーとのスケジュール連携</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            栽培スケジュールをカレンダー標準フォーマット（.icsファイル）としてエクスポートします。お使いのスマートフォンや外部カレンダーアプリにインポートして管理できます。
          </p>
        </div>
        <button 
          onClick={handleExportICal}
          className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0"
        >
          <Download className="w-4.5 h-4.5" /> iCal (.ics) カレンダーをエクスポート
        </button>
      </div>

      {/* PROPOSAL EDIT MODAL */}
      {editingProposal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5 m-0">
                <Pencil className="w-4 h-4 text-emerald-600" />
                お世話タスクの編集
              </h3>
              <button 
                onClick={() => setEditingProposal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Plant Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">対象の植物</label>
                <div className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-xl">
                  {editingProposal.plantName}
                </div>
              </div>

              {/* Task type */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">タスクの種類</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full text-xs font-sans font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="watering">💧 通常水やり</option>
                  <option value="nutrient">🧪 追肥</option>
                  <option value="water_change">💧 水やり・水換え</option>
                  <option value="ph_check">📊 測定・確認</option>
                  <option value="harvest">✂️ 収穫</option>
                  <option value="pruning">✂️ 剪定・芽かき</option>
                  <option value="weeding_aeration">🌱 草取り・中耕</option>
                </select>
              </div>

              {/* Proposed date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">実施予定日</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full text-xs font-sans font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Note / description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 font-sans">作業メモ</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={3}
                  className="w-full text-xs font-sans font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                  placeholder="タスクの詳細を入力してください"
                />
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingProposal(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> 保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL PROPOSAL ADD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5 m-0">
                <Plus className="w-4.5 h-4.5 text-emerald-600" />
                お世話予定の手動登録
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Plant Choice */}
              <div>
                <label className="block text-xs font-bold text-slate-550 mb-1.5">対象の植物</label>
                {(plants || []).filter(p => !p.archived).length === 0 ? (
                  <div className="text-[11px] text-rose-500 font-bold bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                    ⚠️ 栽培中の植物がありません。先にプランター管理から植物を登録してください。
                  </div>
                ) : (
                  <select
                    value={addPlantId}
                    onChange={(e) => setAddPlantId(e.target.value)}
                    className="w-full text-xs font-sans font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {(plants || []).filter(p => !p.archived).map(p => {
                      const sys = systems.find(s => s.id === p.systemId);
                      return (
                        <option key={p.id} value={p.id}>
                          🌱 {p.name} ({sys ? sys.name : "一般プランター"})
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Task type */}
              <div>
                <label className="block text-xs font-bold text-slate-550 mb-1.5">作業内容の種類</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  className="w-full text-xs font-sans font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="watering">💧 通常水やり</option>
                  <option value="nutrient">🧪 追肥</option>
                  <option value="water_change">💧 水やり・水換え</option>
                  <option value="ph_check">📊 測定・確認</option>
                  <option value="harvest">✂️ 収穫</option>
                  <option value="pruning">✂️ 剪定・芽かき</option>
                  <option value="weeding_aeration">🌱 草取り・中耕</option>
                </select>
              </div>

              {/* Proposed date */}
              <div>
                <label className="block text-xs font-bold text-slate-550 mb-1.5">実施予定日</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="w-full text-xs font-sans font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Note / description */}
              <div>
                <label className="block text-xs font-bold text-slate-550 mb-1.5 font-sans">作業メモ</label>
                <textarea
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  rows={3}
                  className="w-full text-xs font-sans font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                  placeholder="例：ハイポニカを希釈して追肥、脇芽を摘み取る、等"
                />
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveAdd}
                disabled={(plants || []).filter(p => !p.archived).length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" /> 予定を追加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
