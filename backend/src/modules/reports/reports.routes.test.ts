import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { ReportsController } from "./reports.controller";
import { createReportsRouter } from "./reports.routes";

const adminUserId = "00000000-0000-4000-8000-000000003101";
const tokenService = new TokenService();

function bearerToken(roles: string[]): string {
  return `Bearer ${tokenService.createAccessToken({
    userId: adminUserId,
    email: "admin@example.edu",
    roles
  })}`;
}

function createMockController() {
  const controller = new ReportsController();

  controller.getOverview = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ overview: { totalBookingOrders: 2 } });
  });
  controller.getBookingReport = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ report: { buckets: [] } });
  });
  controller.getRevenueReport = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ report: { buckets: [] } });
  });
  controller.getCourtUsageReport = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ report: { courts: [] } });
  });
  controller.getRatesReport = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ report: { cancellationRate: 0 } });
  });
  controller.getViolatingUsersReport = vi.fn(
    async (_req: Request, res: Response): Promise<void> => {
      res.status(200).json({ report: { users: [] } });
    }
  );

  return controller;
}

function createTestApp(controller: ReportsController) {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", createReportsRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("reports routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN to view overview report", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/admin/reports/overview")
      .query({
        fromDate: "2026-05-01T00:00:00.000Z",
        toDate: "2026-05-31T23:59:59.999Z"
      })
      .set("Authorization", bearerToken(["ADMIN"]));

    expect(response.status).toBe(200);
    expect(response.body.overview.totalBookingOrders).toBe(2);
    expect(controller.getOverview).toHaveBeenCalledOnce();
  });

  it("forbids USER from report APIs", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/admin/reports/overview")
      .set("Authorization", bearerToken(["USER"]));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(controller.getOverview).not.toHaveBeenCalled();
  });

  it("rejects invalid date range", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/admin/reports/overview")
      .query({
        fromDate: "2026-06-01T00:00:00.000Z",
        toDate: "2026-05-01T00:00:00.000Z"
      })
      .set("Authorization", bearerToken(["ADMIN"]));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.getOverview).not.toHaveBeenCalled();
  });

  it("routes all report endpoints for ADMIN", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);
    const authorization = bearerToken(["ADMIN"]);

    const bookingResponse = await request(app)
      .get("/api/admin/reports/bookings")
      .query({ groupBy: "day" })
      .set("Authorization", authorization);
    const revenueResponse = await request(app)
      .get("/api/admin/reports/revenue")
      .query({ groupBy: "month" })
      .set("Authorization", authorization);
    const courtUsageResponse = await request(app)
      .get("/api/admin/reports/courts/usage")
      .set("Authorization", authorization);
    const ratesResponse = await request(app)
      .get("/api/admin/reports/rates")
      .set("Authorization", authorization);
    const violationsResponse = await request(app)
      .get("/api/admin/reports/violations")
      .query({ limit: 5 })
      .set("Authorization", authorization);

    expect(bookingResponse.status).toBe(200);
    expect(revenueResponse.status).toBe(200);
    expect(courtUsageResponse.status).toBe(200);
    expect(ratesResponse.status).toBe(200);
    expect(violationsResponse.status).toBe(200);
    expect(controller.getBookingReport).toHaveBeenCalledOnce();
    expect(controller.getRevenueReport).toHaveBeenCalledOnce();
    expect(controller.getCourtUsageReport).toHaveBeenCalledOnce();
    expect(controller.getRatesReport).toHaveBeenCalledOnce();
    expect(controller.getViolatingUsersReport).toHaveBeenCalledOnce();
  });

  it("rejects unsupported report groupBy", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/admin/reports/bookings")
      .query({ groupBy: "week" })
      .set("Authorization", bearerToken(["ADMIN"]));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.getBookingReport).not.toHaveBeenCalled();
  });
});
