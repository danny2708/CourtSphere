import cors from "cors";
import express from "express";

import { corsOrigins } from "./config/env";
import { AppError, errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { requestLogger } from "./middlewares/request-logger.middleware";
import availabilityRouter from "./modules/availability/availability.routes";
import authRouter from "./modules/auth/auth.routes";
import bookingsRouter from "./modules/bookings/bookings.routes";
import courtsRouter from "./modules/courts/courts.routes";
import managerRouter from "./modules/manager/manager.routes";
import notificationsRouter from "./modules/notifications/notifications.routes";
import paymentsRouter from "./modules/payments/payments.routes";
import refundsRouter from "./modules/refunds/refunds.routes";
import rulesRouter from "./modules/rules/rules.routes";
import usersRouter from "./modules/users/users.routes";
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
app.use("/api", availabilityRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api", paymentsRouter);
app.use("/api", refundsRouter);
app.use("/api", managerRouter);
app.use("/api/admin", rulesRouter);
app.use("/api/admin", usersRouter);

app.use(notFoundHandler);
app.use(errorHandler);
