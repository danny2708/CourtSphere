import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { RefundsController } from "./refunds.controller";
import { createRefundsRouter } from "./refunds.routes";

const userId = "00000000-0000-4000-8000-000000001301";
const bookingId = "00000000-0000-4000-8000-000000001302";
const refundId = "00000000-0000-4000-8000-000000001303";
const tokenService = new TokenService();

function bearerToken(roles: string[]): string {
  return `Bearer ${tokenService.createAccessToken({
    userId,
    email: "user@example.edu",
    roles
  })}`;
}

function createMockController() {
  const controller = new RefundsController();

  controller.listRefundsForAdmin = vi.fn(
    async (_req: Request, res: Response): Promise<void> => {
      res.status(200).json({ refunds: [] });
    }
  );
  controller.getRefundDetailForAdmin = vi.fn(
    async (req: Request, res: Response): Promise<void> => {
      res.status(200).json({ refund: { id: req.params.id } });
    }
  );
  controller.retryRefund = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ refund: { id: req.params.id, refundStatus: "SUCCESS" } });
  });
  controller.cancelBookingDueToCourtIssue = vi.fn(
    async (req: Request, res: Response): Promise<void> => {
      res.status(200).json({
        booking: {
          id: req.params.id,
          bookingStatus: req.user?.roles.includes("ADMIN")
            ? "CANCELLED_BY_ADMIN"
            : "CANCELLED_BY_MANAGER"
        },
        refund: {
          id: refundId,
          refundStatus: "REQUESTED"
        }
      });
    }
  );

  return controller;
}

function createTestApp(controller: RefundsController) {
  const app = express();
  app.use(express.json());
  app.use("/api", createRefundsRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("refund routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN to list and view refunds", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);
    const authorization = bearerToken(["ADMIN"]);

    const listResponse = await request(app)
      .get("/api/admin/refunds")
      .query({ refundStatus: "REQUESTED", bookingCode: "BK" })
      .set("Authorization", authorization);
    const detailResponse = await request(app)
      .get(`/api/admin/refunds/${refundId}`)
      .set("Authorization", authorization);

    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(controller.listRefundsForAdmin).toHaveBeenCalledOnce();
    expect(controller.getRefundDetailForAdmin).toHaveBeenCalledOnce();
  });

  it("forbids USER from admin refund APIs", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/admin/refunds")
      .set("Authorization", bearerToken(["USER"]));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(controller.listRefundsForAdmin).not.toHaveBeenCalled();
  });

  it("allows ADMIN to retry refund", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/admin/refunds/${refundId}/retry`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ mockResult: "SUCCESS" });

    expect(response.status).toBe(200);
    expect(response.body.refund).toEqual({
      id: refundId,
      refundStatus: "SUCCESS"
    });
    expect(controller.retryRefund).toHaveBeenCalledOnce();
  });

  it("allows FIELD_MANAGER and ADMIN to cancel bookings due to court issue", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const managerResponse = await request(app)
      .post(`/api/manager/bookings/${bookingId}/cancel`)
      .set("Authorization", bearerToken(["FIELD_MANAGER"]))
      .send({ reason: "Court maintenance" });
    const adminResponse = await request(app)
      .post(`/api/manager/bookings/${bookingId}/cancel`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ reason: "System incident" });

    expect(managerResponse.status).toBe(200);
    expect(managerResponse.body.booking.bookingStatus).toBe("CANCELLED_BY_MANAGER");
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.booking.bookingStatus).toBe("CANCELLED_BY_ADMIN");
    expect(controller.cancelBookingDueToCourtIssue).toHaveBeenCalledTimes(2);
  });

  it("forbids USER from manager cancellation API", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/manager/bookings/${bookingId}/cancel`)
      .set("Authorization", bearerToken(["USER"]))
      .send({ reason: "Court maintenance" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(controller.cancelBookingDueToCourtIssue).not.toHaveBeenCalled();
  });

  it("rejects invalid retry and manager-cancel payloads", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const retryResponse = await request(app)
      .post(`/api/admin/refunds/${refundId}/retry`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ mockResult: "REQUESTED" });
    const cancelResponse = await request(app)
      .post(`/api/manager/bookings/${bookingId}/cancel`)
      .set("Authorization", bearerToken(["FIELD_MANAGER"]))
      .send({ reason: "x" });

    expect(retryResponse.status).toBe(400);
    expect(cancelResponse.status).toBe(400);
    expect(controller.retryRefund).not.toHaveBeenCalled();
    expect(controller.cancelBookingDueToCourtIssue).not.toHaveBeenCalled();
  });
});
