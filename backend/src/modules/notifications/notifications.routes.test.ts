import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { NotificationsController } from "./notifications.controller";
import { createNotificationsRouter } from "./notifications.routes";

const userId = "00000000-0000-4000-8000-000000001901";
const notificationId = "00000000-0000-4000-8000-000000001902";
const tokenService = new TokenService();

function bearerToken(): string {
  return `Bearer ${tokenService.createAccessToken({
    userId,
    email: "user@example.edu",
    roles: ["USER"]
  })}`;
}

function createMockController() {
  const controller = new NotificationsController();

  controller.listMyNotifications = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ notifications: [{ id: notificationId, isRead: false }] });
  });
  controller.markAsRead = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ notification: { id: req.params.id, isRead: true } });
  });
  controller.markAllAsRead = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ updatedCount: 2 });
  });
  controller.getUnreadCount = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ count: 3 });
  });

  return controller;
}

function createTestApp(controller: NotificationsController) {
  const app = express();
  app.use(express.json());
  app.use("/api/notifications", createNotificationsRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("notifications routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication for notification APIs", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app).get("/api/notifications");

    expect(response.status).toBe(401);
    expect(controller.listMyNotifications).not.toHaveBeenCalled();
  });

  it("lists my notifications with filters", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/notifications")
      .query({ isRead: "false", type: "PAYMENT_SUCCESS", page: 1, limit: 20 })
      .set("Authorization", bearerToken());

    expect(response.status).toBe(200);
    expect(response.body.notifications).toEqual([{ id: notificationId, isRead: false }]);
    expect(controller.listMyNotifications).toHaveBeenCalledOnce();
  });

  it("rejects invalid notification type filter", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/notifications")
      .query({ type: "UNKNOWN" })
      .set("Authorization", bearerToken());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.listMyNotifications).not.toHaveBeenCalled();
  });

  it("marks one notification as read", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set("Authorization", bearerToken());

    expect(response.status).toBe(200);
    expect(response.body.notification).toEqual({ id: notificationId, isRead: true });
    expect(controller.markAsRead).toHaveBeenCalledOnce();
  });

  it("marks all notifications as read", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .patch("/api/notifications/read-all")
      .set("Authorization", bearerToken());

    expect(response.status).toBe(200);
    expect(response.body.updatedCount).toBe(2);
    expect(controller.markAllAsRead).toHaveBeenCalledOnce();
  });

  it("returns unread notification count", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", bearerToken());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ count: 3 });
    expect(controller.getUnreadCount).toHaveBeenCalledOnce();
  });
});

