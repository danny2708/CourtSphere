import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { ManagerController } from "./manager.controller";
import { createManagerRouter } from "./manager.routes";

const managerUserId = "00000000-0000-4000-8000-000000001501";
const bookingItemId = "00000000-0000-4000-8000-000000001502";
const tokenService = new TokenService();

function bearerToken(roles: string[]): string {
  return `Bearer ${tokenService.createAccessToken({
    userId: managerUserId,
    email: "manager@example.edu",
    roles
  })}`;
}

function createMockController() {
  const controller = new ManagerController();

  controller.getTodaySchedule = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ bookingItems: [] });
  });
  controller.checkInBookingItem = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ bookingItem: { id: req.params.id, itemStatus: "IN_USE" } });
  });
  controller.overrideLateCheckin = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ bookingItem: { id: req.params.id, itemStatus: "IN_USE" } });
  });
  controller.markNoShow = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      bookingItem: { id: req.params.id, itemStatus: "NO_SHOW" },
      violation: { id: "00000000-0000-4000-8000-000000001503" }
    });
  });
  controller.overrideComplete = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ bookingItem: { id: req.params.id, itemStatus: "COMPLETED" } });
  });

  return controller;
}

function createTestApp(controller: ManagerController) {
  const app = express();
  app.use(express.json());
  app.use("/api", createManagerRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("manager routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows FIELD_MANAGER to view today's booking item schedule", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/manager/bookings/today")
      .set("Authorization", bearerToken(["FIELD_MANAGER"]));

    expect(response.status).toBe(200);
    expect(response.body.bookingItems).toEqual([]);
    expect(controller.getTodaySchedule).toHaveBeenCalledOnce();
  });

  it("forbids USER from manager schedule", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/manager/bookings/today")
      .set("Authorization", bearerToken(["USER"]));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(controller.getTodaySchedule).not.toHaveBeenCalled();
  });

  it("allows FIELD_MANAGER to check in a booking item", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/manager/booking-items/${bookingItemId}/check-in`)
      .set("Authorization", bearerToken(["FIELD_MANAGER"]));

    expect(response.status).toBe(200);
    expect(response.body.bookingItem).toMatchObject({
      id: bookingItemId,
      itemStatus: "IN_USE"
    });
    expect(controller.checkInBookingItem).toHaveBeenCalledOnce();
  });

  it("does not allow USER to check in", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/manager/booking-items/${bookingItemId}/check-in`)
      .set("Authorization", bearerToken(["USER"]));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(controller.checkInBookingItem).not.toHaveBeenCalled();
  });

  it("requires reason for late check-in override and manual complete", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);
    const authorization = bearerToken(["FIELD_MANAGER"]);

    const overrideResponse = await request(app)
      .post(`/api/manager/booking-items/${bookingItemId}/override-checkin`)
      .set("Authorization", authorization)
      .send({});
    const completeResponse = await request(app)
      .post(`/api/manager/booking-items/${bookingItemId}/override-complete`)
      .set("Authorization", authorization)
      .send({});

    expect(overrideResponse.status).toBe(400);
    expect(completeResponse.status).toBe(400);
    expect(overrideResponse.body.error.code).toBe("VALIDATION_ERROR");
    expect(completeResponse.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.overrideLateCheckin).not.toHaveBeenCalled();
    expect(controller.overrideComplete).not.toHaveBeenCalled();
  });

  it("allows ADMIN to mark no-show", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/manager/booking-items/${bookingItemId}/no-show`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ reason: "User did not arrive" });

    expect(response.status).toBe(200);
    expect(response.body.bookingItem.itemStatus).toBe("NO_SHOW");
    expect(response.body.violation.id).toBe("00000000-0000-4000-8000-000000001503");
    expect(controller.markNoShow).toHaveBeenCalledOnce();
  });
});
