import type { RequestHandler } from "express";

import { rbacService, type RoleName } from "../modules/auth/services/rbac.service";
import { AppError } from "./error.middleware";

export function requireRole(allowedRoles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
      return;
    }

    const hasRole = rbacService.hasAnyRole(req.user.roles, allowedRoles);

    if (!hasRole) {
      next(new AppError(403, "Insufficient role", "FORBIDDEN"));
      return;
    }

    next();
  };
}
