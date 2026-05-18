import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { RulesController } from "./rules.controller";
import { createRulesRouter } from "./rules.routes";

const actorUserId = "00000000-0000-4000-8000-000000000501";
const priorityGroupId = "00000000-0000-4000-8000-000000000502";
const priorityPolicyId = "00000000-0000-4000-8000-000000000503";
const tokenService = new TokenService();

function bearerToken(roles: string[]): string {
  return `Bearer ${tokenService.createAccessToken({
    userId: actorUserId,
    email: "admin@example.edu",
    roles
  })}`;
}

function createMockController() {
  const controller = new RulesController();

  controller.getBookingRules = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ bookingRules: { holdMinutes: 10 } });
  });
  controller.updateBookingRules = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ bookingRules: req.body });
  });
  controller.listPriorityGroups = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ priorityGroups: [] });
  });
  controller.updatePriorityGroup = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ priorityGroup: { id: req.params.id, ...req.body } });
  });
  controller.listPriorityPolicies = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ priorityPolicies: [] });
  });
  controller.updatePriorityPolicy = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ priorityPolicy: { id: req.params.id, ...req.body } });
  });

  return controller;
}

function createTestApp(controller: RulesController) {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", createRulesRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("rules routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN to get and update booking rules", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const getResponse = await request(app)
      .get("/api/admin/booking-rules")
      .set("Authorization", bearerToken(["ADMIN"]));
    const updateResponse = await request(app)
      .put("/api/admin/booking-rules")
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({
        holdMinutes: 15,
        refundRateUserOnTime: 80
      });

    expect(getResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(controller.getBookingRules).toHaveBeenCalledOnce();
    expect(controller.updateBookingRules).toHaveBeenCalledOnce();
  });

  it("forbids USER and FIELD_MANAGER from updating booking rules", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const userResponse = await request(app)
      .put("/api/admin/booking-rules")
      .set("Authorization", bearerToken(["USER"]))
      .send({ holdMinutes: 15 });
    const managerResponse = await request(app)
      .put("/api/admin/booking-rules")
      .set("Authorization", bearerToken(["FIELD_MANAGER"]))
      .send({ holdMinutes: 15 });

    expect(userResponse.status).toBe(403);
    expect(managerResponse.status).toBe(403);
    expect(controller.updateBookingRules).not.toHaveBeenCalled();
  });

  it("rejects invalid booking rule payloads", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const holdResponse = await request(app)
      .put("/api/admin/booking-rules")
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ holdMinutes: 0 });
    const refundResponse = await request(app)
      .put("/api/admin/booking-rules")
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ refundRateUserOnTime: 101 });

    expect(holdResponse.status).toBe(400);
    expect(refundResponse.status).toBe(400);
    expect(controller.updateBookingRules).not.toHaveBeenCalled();
  });

  it("allows ADMIN to update priority group and priority policy", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const groupResponse = await request(app)
      .put(`/api/admin/priority-groups/${priorityGroupId}`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({
        groupName: "Student",
        groupCode: "STUDENT",
        priorityLevel: 2,
        advanceBookingDays: 7
      });
    const policyResponse = await request(app)
      .put(`/api/admin/priority-policies/${priorityPolicyId}`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({
        priorityGroupId,
        priorityRank: 2,
        advanceBookingDays: 7,
        maxBookingsPerDay: 3,
        canJoinWaitlist: true
      });

    expect(groupResponse.status).toBe(200);
    expect(policyResponse.status).toBe(200);
    expect(controller.updatePriorityGroup).toHaveBeenCalledOnce();
    expect(controller.updatePriorityPolicy).toHaveBeenCalledOnce();
  });
});
