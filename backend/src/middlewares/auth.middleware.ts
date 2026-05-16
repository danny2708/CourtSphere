import type { RequestHandler } from "express";

import { AppError } from "./error.middleware";

export type AuthenticatedUser = {
  id: string;
  roles: string[];
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export const attachAuthenticatedUser: RequestHandler = (_req, _res, next) => {
  next();
};

export const requireAuthentication: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
    return;
  }

  next();
};
