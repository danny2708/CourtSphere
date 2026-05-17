import cors from "cors";
import express from "express";

import { corsOrigins } from "./config/env";
import { AppError, errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { requestLogger } from "./middlewares/request-logger.middleware";
import authRouter from "./modules/auth/auth.routes";
import courtsRouter from "./modules/courts/courts.routes";
import healthRouter from "./routes/health.routes";

export const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || corsOrigins.includes("*") || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new AppError(403, "CORS origin is not allowed", "CORS_ORIGIN_DENIED"));
    }
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);

app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", courtsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
