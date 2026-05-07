import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { NAV_ITEMS } from "@/lib/constants";

export function AppLayout() {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentPath = location.pathname === "/" ? "/dashboard" : location.pathname;
  const currentItem = NAV_ITEMS.find((item) => item.to === currentPath);

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)} />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-[min(88vw,22rem)] p-4 transition duration-300 lg:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar className="h-full" onNavigate={() => setMobileNavOpen(false)} />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <Sidebar className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[19rem] shrink-0 lg:flex" />
        <div className="flex min-h-full min-w-0 flex-1 flex-col gap-6">
          <Topbar
            description={currentItem?.description ?? "K-Sync operational workspace."}
            onMenuClick={() => setMobileNavOpen(true)}
            title={currentItem?.label ?? "K-Sync"}
          />
          <main className="min-h-[calc(100vh-8rem)] rounded-[32px] border border-white/60 bg-white/72 p-4 shadow-[0_35px_90px_-65px_rgba(15,23,42,0.7)] backdrop-blur sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
