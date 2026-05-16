import type { RequestHandler } from "express";

import { env } from "../config/env";
import { logger } from "../utils/logger";

export const requestLogger: RequestHandler = (req, res, next) => {
  if (env.NODE_ENV === "test") {
    next();
    return;
  }

  const startedAt = Date.now();

  res.on("finish", () => {
    logger.info("request.completed", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
};
