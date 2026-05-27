import { Outlet } from "react-router-dom";

import { ToastViewport } from "../common/ToastViewport";
import { AppHeader } from "./AppHeader";
import { BottomNavigation } from "./BottomNavigation";

export function AppLayout() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNavigation />
      <ToastViewport />
    </div>
  );
}
