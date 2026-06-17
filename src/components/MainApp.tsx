import { Navigate, Route, Routes } from "react-router-dom";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { defaultToolPath } from "@/lib/tools/registry";
import { PlatformSessionsPage } from "@/tools/sessions/PlatformSessionsPage";
import { ToolPage } from "@/tools/shared/ToolPage";

export function MainApp() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to={defaultToolPath} replace />} />
        <Route
          path="platforms/:platform/sessions"
          element={<PlatformSessionsPage />}
        />
        <Route path="tools/:platform/:toolSlug" element={<ToolPage />} />
        <Route path="*" element={<Navigate to={defaultToolPath} replace />} />
      </Route>
    </Routes>
  );
}
