import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "../components/common/LoadingState";
import { ROUTE_PATHS } from "./route-paths";
import { useAuthStore } from "../stores/auth.store";
import type { RoleName } from "../types/auth.types";

type RoleRouteProps = {
  roles: RoleName | RoleName[];
};

export function RoleRoute({ roles }: RoleRouteProps) {
  const location = useLocation();
  const { hasRole, isLoading, user } = useAuthStore();

  if (isLoading) {
    return <LoadingState message="Đang kiểm tra quyền truy cập..." />;
  }

  if (!user) {
    return <Navigate to={ROUTE_PATHS.login} replace state={{ from: location }} />;
  }

  if (!hasRole(roles)) {
    return <Navigate to={ROUTE_PATHS.forbidden} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
