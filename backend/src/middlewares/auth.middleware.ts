import type { RequestHandler } from "express";

import { tokenService } from "../modules/auth/services/token.service";
import { AppError } from "./error.middleware";

export type AuthenticatedUser = {
  id: string;
  email: string;
  roles: string[];
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

function getBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export const attachAuthenticatedUser: RequestHandler = (req, _res, next) => {
  const token = getBearerToken(req.header("authorization"));

  if (!token) {
    next();
    return;
  }

  try {
    const payload = tokenService.verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles
    };
  } catch {
    // Optional auth intentionally ignores invalid tokens. Protected routes use requireAuth.
  }

  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = getBearerToken(req.header("authorization"));

  if (!token) {
    next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
    return;
  }

  try {
    const payload = tokenService.verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles
    };

    next();
  } catch {
    next(new AppError(401, "Invalid or expired access token", "INVALID_ACCESS_TOKEN"));
  }
};

export const requireAuthentication = requireAuth;
