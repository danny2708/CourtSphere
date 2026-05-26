import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { ViolationsController } from "./violations.controller";
import { createViolationsRouter } from "./violations.routes";

const adminUserId = "00000000-0000-4000-8000-000000002301";
const violationId = "00000000-0000-4000-8000-000000002302";
const bookingItemId = "00000000-0000-4000-8000-000000002303";
const tokenService = new TokenService();

function bearerToken(roles: string[]): string {
  return `Bearer ${tokenService.createAccessToken({
    userId: adminUserId,
    email: "admin@example.edu",
    roles
  })}`;
}

function createMockController() {
  const controller = new ViolationsController();

  controller.listViolations = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ violations: [{ id: violationId, violationType: "NO_SHOW" }] });
  });
  controller.waiveViolation = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ violation: { id: req.params.id, isWaived: true } });
  });
  controller.adjustViolationPoints = vi.fn(
    async (req: Request, res: Response): Promise<void> => {
      res.status(200).json({
        violation: { id: req.params.id, penaltyPoints: req.body.penaltyPoints }
      });
    }
  );

  return controller;
}

function createTestApp(controller: ViolationsController) {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", createViolationsRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("violations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN to list violations with filters", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/admin/violations")
      .query({
        violationType: "NO_SHOW",
        isWaived: "false",
        bookingItemId
      })
      .set("Authorization", bearerToken(["ADMIN"]));

    expect(response.status).toBe(200);
    expect(response.body.violations).toEqual([{ id: violationId, violationType: "NO_SHOW" }]);
    expect(controller.listViolations).toHaveBeenCalledOnce();
  });

  it("allows FIELD_MANAGER to list violations", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/admin/violations")
      .set("Authorization", bearerToken(["FIELD_MANAGER"]));

    expect(response.status).toBe(200);
    expect(controller.listViolations).toHaveBeenCalledOnce();
  });

  it("forbids USER from listing violations", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get("/api/admin/violations")
      .set("Authorization", bearerToken(["USER"]));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(controller.listViolations).not.toHaveBeenCalled();
  });

  it("allows ADMIN to waive a violation", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/admin/violations/${violationId}/waive`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ reason: "Valid documented reason" });

    expect(response.status).toBe(200);
    expect(response.body.violation).toEqual({ id: violationId, isWaived: true });
    expect(controller.waiveViolation).toHaveBeenCalledOnce();
  });

  it("requires reason when waiving a violation", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/admin/violations/${violationId}/waive`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.waiveViolation).not.toHaveBeenCalled();
  });

  it("allows ADMIN to adjust violation points", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/admin/violations/${violationId}/adjust-points`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ penaltyPoints: 3, reason: "Severity adjusted" });

    expect(response.status).toBe(200);
    expect(response.body.violation).toEqual({ id: violationId, penaltyPoints: 3 });
    expect(controller.adjustViolationPoints).toHaveBeenCalledOnce();
  });

  it("rejects negative adjusted violation points", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .post(`/api/admin/violations/${violationId}/adjust-points`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ penaltyPoints: -1, reason: "Invalid adjustment" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.adjustViolationPoints).not.toHaveBeenCalled();
  });

  it("forbids FIELD_MANAGER from waiving or adjusting violations", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);
    const authorization = bearerToken(["FIELD_MANAGER"]);

    const waiveResponse = await request(app)
      .post(`/api/admin/violations/${violationId}/waive`)
      .set("Authorization", authorization)
      .send({ reason: "Manager cannot waive" });
    const adjustResponse = await request(app)
      .post(`/api/admin/violations/${violationId}/adjust-points`)
      .set("Authorization", authorization)
      .send({ penaltyPoints: 0, reason: "Manager cannot adjust" });

    expect(waiveResponse.status).toBe(403);
    expect(adjustResponse.status).toBe(403);
    expect(controller.waiveViolation).not.toHaveBeenCalled();
    expect(controller.adjustViolationPoints).not.toHaveBeenCalled();
  });
});
