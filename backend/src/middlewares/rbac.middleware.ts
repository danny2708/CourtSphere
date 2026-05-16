import type { RequestHandler } from "express";

import { AppError } from "./error.middleware";

export function requireRole(allowedRoles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
      return;
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      next(new AppError(403, "Insufficient role", "FORBIDDEN"));
      return;
    }

    next();
  };
}
