import { ROUTE_PATHS } from "../../../routes/route-paths";
import type { AuthUser, RoleName } from "../../../types/auth.types";

export function getDefaultRouteByRole(roles: RoleName[] | undefined): string {
  const currentRoles = roles ?? [];

  if (currentRoles.includes("ADMIN")) {
    return ROUTE_PATHS.adminHome;
  }

  if (currentRoles.includes("FIELD_MANAGER") || currentRoles.includes("MANAGER")) {
    return ROUTE_PATHS.managerHome;
  }

  if (currentRoles.includes("USER")) {
    return ROUTE_PATHS.userHome;
  }

  return ROUTE_PATHS.home;
}

export function getDefaultRouteForUser(user: AuthUser | null): string {
  return getDefaultRouteByRole(user?.roles);
}
