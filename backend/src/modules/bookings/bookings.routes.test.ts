import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { BookingsController } from "./bookings.controller";
import { createBookingsRouter } from "./bookings.routes";

const userId = "00000000-0000-4000-8000-000000000701";
const courtId = "00000000-0000-4000-8000-000000000702";
const bookingOrderId = "00000000-0000-4000-8000-000000000703";
const tokenService = new TokenService();

function bearerToken(roles: string[]): string {
  return `Bearer ${tokenService.createAccessToken({
    userId,
    email: "user@example.edu",
    roles
  })}`;
}

function createMockController() {
  const controller = new BookingsController();

  controller.createBookingHold = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({ booking: { id: bookingOrderId, ...req.body } });
  });
  controller.listMyBookings = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ bookings: [] });
  });
  controller.getBookingDetail = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ booking: { id: req.params.id } });
  });
  controller.cancelMyBooking = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ booking: { id: req.params.id, bookingStatus: "CANCELLED_BY_USER" } });
  });

  return controller;
}

function createTestApp(controller: BookingsController) {
  const app = express();
  app.use(express.json());
  app.use("/api/bookings", createBookingsRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("bookings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows USER to create a booking hold", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", bearerToken(["USER"]))
      .send({
        items: [
          {
            courtId,
            startDatetime: "2026-05-21T08:00:00.000Z",
            endDatetime: "2026-05-21T09:00:00.000Z"
          }
        ],
        note: "Class training"
      });

    expect(response.status).toBe(201);
    expect(response.body.booking).toMatchObject({
      id: bookingOrderId,
      items: [
        {
          courtId
        }
      ],
      note: "Class training"
    });
    expect(controller.createBookingHold).toHaveBeenCalledOnce();
  });

  it("allows USER to list, view, and cancel own bookings", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);
    const authorization = bearerToken(["USER"]);

    const listResponse = await request(app)
      .get("/api/bookings/my")
      .query({ status: "PENDING_PAYMENT" })
      .set("Authorization", authorization);
    const detailResponse = await request(app)
      .get(`/api/bookings/${bookingOrderId}`)
      .set("Authorization", authorization);
    const cancelResponse = await request(app)
      .post(`/api/bookings/${bookingOrderId}/cancel`)
      .set("Authorization", authorization)
      .send({ reason: "Schedule changed" });

    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(cancelResponse.status).toBe(200);
    expect(controller.listMyBookings).toHaveBeenCalledOnce();
    expect(controller.getBookingDetail).toHaveBeenCalledOnce();
    expect(controller.cancelMyBooking).toHaveBeenCalledOnce();
  });

  it("forbids non-USER roles from booking APIs", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", bearerToken(["FIELD_MANAGER"]))
      .send({
        items: [
          {
            courtId,
            startDatetime: "2026-05-21T08:00:00.000Z",
            endDatetime: "2026-05-21T09:00:00.000Z"
          }
        ],
        note: "Class training"
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(controller.createBookingHold).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app).get("/api/bookings/my");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
    expect(controller.listMyBookings).not.toHaveBeenCalled();
  });

  it("rejects invalid create booking payloads", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", bearerToken(["USER"]))
      .send({
        items: [
          {
            courtId,
            startDatetime: "2026-05-21T09:00:00.000Z",
            endDatetime: "2026-05-21T08:00:00.000Z"
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.createBookingHold).not.toHaveBeenCalled();
  });
});

