import React, { useState } from "react";
import { ScheduleProposal, ProposalStatus } from "../types";
import { 
  Calendar, ChevronLeft, ChevronRight, Download, Check, X, Clock, HelpCircle, AlertCircle
} from "lucide-react";

interface CalendarViewProps {
  proposals: any[]; // Hydrated proposals with plantName
  onApproveProposal: (id: string, status: ProposalStatus) => void;
  userToken: string;
  plants: any[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  proposals,
  onApproveProposal,
  userToken,
  plants
}) => {
  // Current calendar date state
  const [currentDate, setCurrentDate] = useState<Date>(new Date("2026-06-03")); // Seed matching current local time metadata
  const [filter, setFilter] = useState<"all" | "approved" | "pending" | "completed">("all");

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

  // Group events by day
  const getEventsForDate = (date: Date) => {
    const dStr = date.toISOString().split("T")[0];
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
  const getTypeStyles = (type: string, status: string) => {
    const isApproved = status === "approved" || status === "completed";
    if (type === "nutrient") {
      return {
        bg: isApproved ? "bg-indigo-50 border-indigo-100" : "bg-indigo-50/40 border-dashed border-indigo-200",
        text: "text-indigo-800",
        badge: "bg-indigo-500",
        label: "🧪 施肥"
      };
    } else if (type === "water_change") {
      return {
        bg: isApproved ? "bg-amber-50 border-amber-100" : "bg-amber-50/40 border-dashed border-amber-200",
        text: "text-amber-800",
        badge: "bg-amber-500",
        label: "💧 水換"
      };
    } else if (type === "ph_check") {
      return {
        bg: isApproved ? "bg-teal-50 border-teal-100" : "bg-teal-50/40 border-dashed border-teal-200",
        text: "text-teal-800",
        badge: "bg-teal-500",
        label: "📊 測定"
      };
    } else if (type === "harvest") {
      return {
        bg: isApproved ? "bg-emerald-50 border-emerald-100" : "bg-emerald-50/40 border-dashed border-emerald-200",
        text: "text-emerald-800",
        badge: "bg-emerald-600",
        label: "✂️ 収穫"
      };
    }
    return {
      bg: "bg-slate-100 border-slate-200",
      text: "text-slate-700",
      badge: "bg-slate-400",
      label: "🌱 タスク"
    };
  };

  const listFilteredProposals = activeProposals.filter(p => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  return (
    <div id="calendar-view-container" className="space-y-6">
      
      {/* Header and Exporter bar */}
      <div id="calendar-header-bar" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" /> 
            栽培計画・お世話スケジュール
          </h2>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed">
            AI提案のタスク及び承認された栽培スケジュールを管理します。iCalでスマホ・Googleカレンダーと連携可能です。
          </p>
        </div>

        <button 
          onClick={handleExportICal}
          className="w-full md:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-2 transition-colors shadow-xs"
        >
          <Download className="w-4 h-4" /> iCal (.ics) カレンダーを書き出す
        </button>
      </div>

      {/* Tabs list filter and simple explanation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter buttons */}
        <div className="bg-slate-100 p-1 rounded-xl inline-flex text-xs font-sans">
          <button 
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${filter === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
          >
            すべて表示
          </button>
          <button 
            onClick={() => setFilter("approved")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${filter === "approved" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
          >
            承認済み
          </button>
          <button 
            onClick={() => setFilter("pending")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${filter === "pending" ? "bg-white text-amber-700 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
          >
            未承認のみ
          </button>
          <button 
            onClick={() => setFilter("completed")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${filter === "completed" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
          >
            完了済み
          </button>
        </div>

        {/* Legend */}
        <div id="calendar-legends" className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-500 block"></span> 🧪 液肥追肥</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500 block"></span> 💧 全水換え</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-teal-500 block"></span> 📊 水質測定</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-600 block"></span> ✂️ 推奨収穫</span>
          <span className="flex items-center gap-1.5 ml-2 font-bold text-amber-600"><Clock className="w-3 h-3" /> 点線：AIからの未承認提案</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* BIG MONTHLY GRID CALENDAR */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col">
          
          {/* Month Controller */}
          <div className="flex items-center justify-between mb-5">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-base font-extrabold text-slate-800">
              {year}年 {month + 1}月
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 text-center font-sans">
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
                return <div key={`empty-${idx}`} className="bg-slate-50/40 rounded-xl min-h-[90px] border border-dashed border-slate-50"></div>;
              }

              const events = getEventsForDate(day);
              const isToday = new Date().toISOString().split("T")[0] === day.toISOString().split("T")[0];

              return (
                <div 
                  key={`day-${day.getDate()}`} 
                  className={`bg-white rounded-xl min-h-[95px] p-2 border transition-all flex flex-col justify-between ${
                    isToday 
                      ? "border-emerald-500 shadow-xs ring-4 ring-emerald-50" 
                      : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-bold font-sans ${
                      day.getDay() === 0 ? "text-rose-500" : day.getDay() === 6 ? "text-blue-500" : "text-slate-700"
                    }`}>
                      {day.getDate()}
                    </span>
                    {isToday && (
                      <span className="text-[8px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded-full scale-90">TODAY</span>
                    )}
                  </div>

                  {/* Day Events stack */}
                  <div className="space-y-1 mt-1 flex-1 flex flex-col justify-end">
                    {events.slice(0, 3).map((ev, eIdx) => {
                      const styles = getTypeStyles(ev.type, ev.status);
                      return (
                        <div 
                          key={ev.id || eIdx} 
                          className={`text-[8.5px] px-1 py-0.5 rounded border leading-tight truncate font-sans font-medium hover:scale-[1.02] transition-transform ${styles.bg} ${styles.text}`}
                          title={`[${ev.plantName}] ${ev.note}`}
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

        {/* LIST DETAILS PANEL */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col h-[520px]">
          <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            提案・スケジュール詳細リスト
          </h3>

          <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3">
            {listFilteredProposals.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-xs">
                該当するスケジュール提案はありません。
              </div>
            ) : (
              listFilteredProposals.map((item, idx) => {
                const styles = getTypeStyles(item.type, item.status);
                const isPending = item.status === "pending";

                return (
                  <div 
                    key={item.id || idx} 
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                      isPending 
                        ? "bg-amber-50/20 border-dashed border-amber-200" 
                        : "bg-slate-50/50 border-slate-100"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start gap-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.status === "completed" 
                            ? "bg-blue-100 text-blue-800 font-extrabold" 
                            : item.status === "approved" 
                            ? "bg-emerald-100 text-emerald-800" 
                            : item.status === "dismissed" 
                            ? "bg-slate-100 text-slate-500" 
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {item.status === "completed" ? "実施完了" : item.status === "approved" ? "承認済" : item.status === "dismissed" ? "却下済" : "未承認"}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">予定日: {item.proposedDate}</span>
                      </div>

                      <div className="text-xs font-bold text-slate-800">
                        {styles.label} - {item.plantName}
                      </div>

                      <p className={`text-[11px] text-slate-600 leading-relaxed font-sans ${item.status === 'completed' ? 'line-through text-slate-400 opacity-60' : ''}`}>{item.note}</p>
                    </div>

                    {item.status === "approved" && (
                      <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100/40">
                        <button 
                          onClick={() => onApproveProposal(item.id, "completed")}
                          className="px-3 py-1.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-0.5 transition-colors shadow-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> 実施完了にする
                        </button>
                      </div>
                    )}

                    {isPending && (
                      <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100/40">
                        <button 
                          onClick={() => onApproveProposal(item.id, "dismissed")}
                          className="px-2.5 py-1 text-[10px] font-bold text-rose-600 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-0.5 transition-colors"
                        >
                          <X className="w-3 h-3" /> 各却下
                        </button>
                        <button 
                          onClick={() => onApproveProposal(item.id, "approved")}
                          className="px-3 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-0.5 transition-colors shadow-xs"
                        >
                          <Check className="w-3 h-3" /> カレンダー承認
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
    </div>
  );
};
