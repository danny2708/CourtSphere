import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { ROUTE_PATHS } from "./route-paths";
import { useAuthStore } from "../stores/auth.store";

export function ProtectedRoute() {
  const location = useLocation();
  const { accessToken, error, isAuthenticated, isLoading, loadCurrentUser, user } = useAuthStore();

  useEffect(() => {
    if (accessToken && !user && !isLoading && !error) {
      void loadCurrentUser();
    }
  }, [accessToken, error, isLoading, loadCurrentUser, user]);

  if (!accessToken) {
    return <Navigate to={ROUTE_PATHS.login} replace state={{ from: location }} />;
  }

  if (isLoading || (accessToken && !user && !error)) {
    return <LoadingState message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Không tải được tài khoản"
        message={error}
        actionLabel="Thử lại"
        onAction={() => {
          void loadCurrentUser();
        }}
      />
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTE_PATHS.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
