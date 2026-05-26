import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { WaitlistController } from "./waitlist.controller";
import { createWaitlistRouter } from "./waitlist.routes";

const userId = "00000000-0000-4000-8000-000000002001";
const otherUserId = "00000000-0000-4000-8000-000000002002";
const courtId = "00000000-0000-4000-8000-000000002003";
const waitlistEntryId = "00000000-0000-4000-8000-000000002004";
const tokenService = new TokenService();

function bearerToken(roles: string[], id = userId): string {
  return `Bearer ${tokenService.createAccessToken({
    userId: id,
    email: `${id}@example.edu`,
    roles
  })}`;
}

function createMockController() {
  const controller = new WaitlistController();

  controller.joinWaitlist = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({
      waitlistEntry: {
        id: waitlistEntryId,
        userId: req.user!.id,
        ...req.body,
        status: "WAITING"
      }
    });
  });
  controller.getMyWaitlist = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ waitlistEntries: [] });
  });
  controller.cancelWaitlist = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      waitlistEntry: {
        id: req.params.id,
        status: "CANCELLED"
      }
    });
  });
  controller.bookFromWaitlist = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({
      booking: {
        bookingOrderId: "00000000-0000-4000-8000-000000002005",
        waitlistEntryId: req.params.id,
        bookingStatus: "PENDING_PAYMENT"
      }
    });
  });

  return controller;
}

function createTestApp(controller: WaitlistController) {
  const app = express();
  app.use(express.json());
  app.use("/api/waitlist", createWaitlistRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("waitlist routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows USER to join and list own waitlist entries", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);
    const authorization = bearerToken(["USER"]);

    const joinResponse = await request(app)
      .post("/api/waitlist")
      .set("Authorization", authorization)
      .send({
        courtId,
        startDatetime: "2026-05-21T08:00:00.000Z",
        endDatetime: "2026-05-21T09:00:00.000Z"
      });
    const listResponse = await request(app)
      .get("/api/waitlist/my")
      .query({ status: "WAITING" })
      .set("Authorization", authorization);

    expect(joinResponse.status).toBe(201);
    expect(listResponse.status).toBe(200);
    expect(controller.joinWaitlist).toHaveBeenCalledOnce();
    expect(controller.getMyWaitlist).toHaveBeenCalledOnce();
  });

  it("allows owner to cancel and book from a notified waitlist entry", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);
    const authorization = bearerToken(["USER"]);

    const cancelResponse = await request(app)
      .delete(`/api/waitlist/${waitlistEntryId}`)
      .set("Authorization", authorization);
    const bookResponse = await request(app)
      .post(`/api/waitlist/${waitlistEntryId}/book`)
      .set("Authorization", authorization);

    expect(cancelResponse.status).toBe(200);
    expect(bookResponse.status).toBe(201);
    expect(controller.cancelWaitlist).toHaveBeenCalledOnce();
    expect(controller.bookFromWaitlist).toHaveBeenCalledOnce();
  });

  it("forbids non-USER roles from waitlist APIs", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post("/api/waitlist")
      .set("Authorization", bearerToken(["FIELD_MANAGER"], otherUserId))
      .send({
        courtId,
        startDatetime: "2026-05-21T08:00:00.000Z",
        endDatetime: "2026-05-21T09:00:00.000Z"
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(controller.joinWaitlist).not.toHaveBeenCalled();
  });

  it("rejects invalid waitlist time payloads", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post("/api/waitlist")
      .set("Authorization", bearerToken(["USER"]))
      .send({
        courtId,
        startDatetime: "2026-05-21T09:00:00.000Z",
        endDatetime: "2026-05-21T08:00:00.000Z"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.joinWaitlist).not.toHaveBeenCalled();
  });
});
