import { NavLink } from "react-router-dom";

import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col rounded-[32px] border border-slate-800 bg-[linear-gradient(180deg,#020617_0%,#0f172a_48%,#082f49_100%)] p-6 text-slate-100 shadow-[0_35px_90px_-55px_rgba(2,6,23,0.95)]",
        className,
      )}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">K-Sync</p>
        <h1 className="mt-3 text-2xl font-semibold">Interoperability Hub</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Unified visibility for SWS, department systems, queue delivery, conflicts, and demo execution.
        </p>
      </div>

      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) =>
              cn(
                "block rounded-2xl border px-4 py-3 text-sm transition",
                isActive
                  ? "border-cyan-400/70 bg-cyan-400/12 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.18)]"
                  : "border-transparent bg-white/5 text-slate-300 hover:border-slate-700 hover:bg-white/10",
              )
            }
            onClick={onNavigate}
            to={item.to}
          >
            <div className="font-medium">{item.label}</div>
            <div className="mt-1 text-xs text-slate-400">{item.description}</div>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Operating Model</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Track canonical events, deterministic translations, sync outcomes, conflict decisions, and retry evidence.
        </p>
      </div>
    </aside>
  );
}
