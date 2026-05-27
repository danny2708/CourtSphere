import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { ToastViewport } from "../common/ToastViewport";
import { useAuthStore } from "../../stores/auth.store";
import { AppHeader } from "./AppHeader";
import { BottomNavigation } from "./BottomNavigation";

export function AppLayout() {
  const { accessToken, error, isLoading, loadCurrentUser, user } = useAuthStore();

  useEffect(() => {
    if (accessToken && !user && !isLoading && !error) {
      void loadCurrentUser();
    }
  }, [accessToken, error, isLoading, loadCurrentUser, user]);

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
