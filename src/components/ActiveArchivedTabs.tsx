import React from "react";

interface ActiveArchivedTabsProps {
  viewArchived: boolean;
  onToggle: (viewArchived: boolean) => void;
  activeCount: number;
  archiveCount: number;
}

export function ActiveArchivedTabs({
  viewArchived,
  onToggle,
  activeCount,
  archiveCount,
}: ActiveArchivedTabsProps) {
  return (
    <div id="active-archived-tabs-nav" className="flex border-b border-slate-100 pb-1">
      <button
        id="btn-tab-active-plants"
        type="button"
        onClick={() => onToggle(false)}
        className={`pb-2 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
          !viewArchived
            ? "border-emerald-600 text-slate-800 font-extrabold"
            : "border-transparent text-slate-400 hover:text-slate-600"
        }`}
      >
        <span>🟢</span> 栽培中の植物 ({activeCount} 株)
      </button>
      <button
        id="btn-tab-archived-plants"
        type="button"
        onClick={() => onToggle(true)}
        className={`pb-2 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
          viewArchived
            ? "border-emerald-600 text-slate-800 font-extrabold"
            : "border-transparent text-slate-400 hover:text-slate-600"
        }`}
      >
        <span>📦</span> 栽培完了した植物 ({archiveCount} 株)
      </button>
    </div>
  );
}
