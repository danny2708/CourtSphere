import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { PaymentsController } from "./payments.controller";
import { createPaymentsRouter } from "./payments.routes";

const userId = "00000000-0000-4000-8000-000000001001";
const bookingOrderId = "00000000-0000-4000-8000-000000001002";
const paymentId = "00000000-0000-4000-8000-000000001003";
const tokenService = new TokenService();

function bearerToken(roles: string[]): string {
  return `Bearer ${tokenService.createAccessToken({
    userId,
    email: "user@example.edu",
    roles
  })}`;
}

function createMockController() {
  const controller = new PaymentsController();

  controller.createPaymentForBooking = vi.fn(
    async (_req: Request, res: Response): Promise<void> => {
      res.status(201).json({ payment: { id: paymentId, paymentStatus: "PROCESSING" } });
    }
  );
  controller.handleMockCallback = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ payment: { id: paymentId, paymentStatus: "SUCCESS" } });
  });
  controller.getPaymentDetail = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ payment: { id: req.params.id } });
  });
  controller.listPaymentsForAdmin = vi.fn(
    async (_req: Request, res: Response): Promise<void> => {
      res.status(200).json({ payments: [] });
    }
  );

  return controller;
}

function createTestApp(controller: PaymentsController) {
  const app = express();
  app.use(express.json());
  app.use("/api", createPaymentsRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("payments routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows USER to create payment for own booking order", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/bookings/${bookingOrderId}/payments`)
      .set("Authorization", bearerToken(["USER"]))
      .send({ amount: 50000 });

    expect(response.status).toBe(201);
    expect(response.body.payment).toEqual({
      id: paymentId,
      paymentStatus: "PROCESSING"
    });
    expect(controller.createPaymentForBooking).toHaveBeenCalledOnce();
  });

  it("requires USER role to create payment", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/bookings/${bookingOrderId}/payments`)
      .set("Authorization", bearerToken(["FIELD_MANAGER"]))
      .send({ amount: 50000 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(controller.createPaymentForBooking).not.toHaveBeenCalled();
  });

  it("allows public mock payment callback with valid payload shape", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app).post("/api/payments/callback/mock").send({
      gatewayTransactionId: "mock_tx_1",
      status: "SUCCESS",
      signature: "signature"
    });

    expect(response.status).toBe(200);
    expect(controller.handleMockCallback).toHaveBeenCalledOnce();
  });

  it("rejects invalid callback payload", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app).post("/api/payments/callback/mock").send({
      gatewayTransactionId: "mock_tx_1",
      status: "PROCESSING",
      signature: "signature"
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.handleMockCallback).not.toHaveBeenCalled();
  });

  it("allows authenticated users to get payment detail", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get(`/api/payments/${paymentId}`)
      .set("Authorization", bearerToken(["USER"]));

    expect(response.status).toBe(200);
    expect(response.body.payment).toEqual({ id: paymentId });
    expect(controller.getPaymentDetail).toHaveBeenCalledOnce();
  });

  it("allows ADMIN and forbids USER on admin payment list", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const adminResponse = await request(app)
      .get("/api/admin/payments")
      .query({ status: "PROCESSING", bookingCode: "BK" })
      .set("Authorization", bearerToken(["ADMIN"]));
    const userResponse = await request(app)
      .get("/api/admin/payments")
      .set("Authorization", bearerToken(["USER"]));

    expect(adminResponse.status).toBe(200);
    expect(userResponse.status).toBe(403);
    expect(controller.listPaymentsForAdmin).toHaveBeenCalledOnce();
  });
});

