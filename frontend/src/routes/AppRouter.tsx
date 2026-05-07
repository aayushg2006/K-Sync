import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { AuditPage } from "@/pages/AuditPage";
import { BusinessSyncPage } from "@/pages/BusinessSyncPage";
import { ConflictsPage } from "@/pages/ConflictsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DemoControlPage } from "@/pages/DemoControlPage";
import { EventsPage } from "@/pages/EventsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/business-sync" element={<BusinessSyncPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/demo-control" element={<DemoControlPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
