import { Menu } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";

type TopbarProps = {
  description: string;
  onMenuClick: () => void;
  title: string;
};

export function Topbar({ description, onMenuClick, title }: TopbarProps) {
  return (
    <header className="rounded-[30px] border border-white/70 bg-white/80 px-5 py-4 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.6)] backdrop-blur sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">K-Sync Console</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-[2rem]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge className="hidden md:inline-flex" variant="active">
            Operations View
          </StatusBadge>
          <button
            aria-label="Open navigation"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 lg:hidden"
            onClick={onMenuClick}
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
