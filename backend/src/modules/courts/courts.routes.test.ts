import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler, notFoundHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { CourtsController } from "./courts.controller";
import { createCourtsRouter } from "./courts.routes";

const userId = "00000000-0000-4000-8000-000000000001";
const courtTypeId = "00000000-0000-4000-8000-000000000002";
const courtId = "00000000-0000-4000-8000-000000000003";

const tokenService = new TokenService();

function bearerToken(roles: string[]): string {
  return `Bearer ${tokenService.createAccessToken({
    userId,
    email: "tester@example.edu",
    roles
  })}`;
}

function createTestApp(controller: CourtsController): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api", createCourtsRouter(controller));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function createMockController() {
  const controller = new CourtsController();

  controller.listCourtTypes = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ courtTypes: [] });
  });
  controller.listCourts = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ courts: [] });
  });
  controller.createCourtType = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(201).json({ courtType: { id: courtTypeId, typeName: "Football" } });
  });
  controller.createCourt = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(201).json({ court: { id: courtId, courtName: "Main Field" } });
  });
  controller.updateCourtStatus = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ court: { id: req.params.id, status: req.body.status } });
  });
  controller.createOperatingHour = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(201).json({ operatingHour: { id: "00000000-0000-4000-8000-000000000004" } });
  });
  controller.createPricingRule = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(201).json({ pricingRule: { id: "00000000-0000-4000-8000-000000000005" } });
  });

  return {
    app: createTestApp(controller),
    controller,
    createCourtType: controller.createCourtType,
    createCourt: controller.createCourt,
    updateCourtStatus: controller.updateCourtStatus,
    createOperatingHour: controller.createOperatingHour,
    createPricingRule: controller.createPricingRule
  };
}

describe("courts routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists court types for an authenticated user", async () => {
    const { app, controller } = createMockController();

    const response = await request(app)
      .get("/api/court-types")
      .set("Authorization", bearerToken(["USER"]));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ courtTypes: [] });
    expect(controller.listCourtTypes).toHaveBeenCalledOnce();
  });

  it("lists courts for an authenticated user", async () => {
    const { app, controller } = createMockController();

    const response = await request(app)
      .get("/api/courts")
      .query({ keyword: "main", courtTypeId, status: "ACTIVE" })
      .set("Authorization", bearerToken(["USER"]));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ courts: [] });
    expect(controller.listCourts).toHaveBeenCalledOnce();
  });

  it("allows ADMIN to create a court type", async () => {
    const { app, createCourtType } = createMockController();

    const response = await request(app)
      .post("/api/admin/court-types")
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ typeName: "Football", description: "Outdoor football fields" });

    expect(response.status).toBe(201);
    expect(response.body.courtType).toMatchObject({ id: courtTypeId, typeName: "Football" });
    expect(createCourtType).toHaveBeenCalledOnce();
  });

  it("forbids USER from creating a court type", async () => {
    const { app, createCourtType } = createMockController();

    const response = await request(app)
      .post("/api/admin/court-types")
      .set("Authorization", bearerToken(["USER"]))
      .send({ typeName: "Football" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(createCourtType).not.toHaveBeenCalled();
  });

  it("allows ADMIN to create a court", async () => {
    const { app, createCourt } = createMockController();

    const response = await request(app)
      .post("/api/admin/courts")
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({
        courtTypeId,
        courtName: "Main Field"
      });

    expect(response.status).toBe(201);
    expect(response.body.court).toMatchObject({ id: courtId, courtName: "Main Field" });
    expect(createCourt).toHaveBeenCalledOnce();
  });

  it("allows ADMIN and FIELD_MANAGER to update court status", async () => {
    const { app, updateCourtStatus } = createMockController();

    const adminResponse = await request(app)
      .patch(`/api/admin/courts/${courtId}/status`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ status: "MAINTENANCE", reason: "Scheduled maintenance" });

    const managerResponse = await request(app)
      .patch(`/api/admin/courts/${courtId}/status`)
      .set("Authorization", bearerToken(["FIELD_MANAGER"]))
      .send({ status: "TEMP_CLOSED", reason: "Weather" });

    expect(adminResponse.status).toBe(200);
    expect(managerResponse.status).toBe(200);
    expect(updateCourtStatus).toHaveBeenCalledTimes(2);
  });

  it("rejects operating hours when openTime is not earlier than closeTime", async () => {
    const { app, createOperatingHour } = createMockController();

    const response = await request(app)
      .post(`/api/admin/courts/${courtId}/operating-hours`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({
        weekday: 1,
        openTime: "18:00",
        closeTime: "08:00",
        slotDurationMinutes: 60
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(createOperatingHour).not.toHaveBeenCalled();
  });

  it("allows FIELD_MANAGER to create operating hours", async () => {
    const { app, createOperatingHour } = createMockController();

    const response = await request(app)
      .post(`/api/admin/courts/${courtId}/operating-hours`)
      .set("Authorization", bearerToken(["FIELD_MANAGER"]))
      .send({
        weekday: 1,
        openTime: "07:00",
        closeTime: "23:00",
        slotDurationMinutes: 60
      });

    expect(response.status).toBe(201);
    expect(createOperatingHour).toHaveBeenCalledOnce();
  });

  it("rejects pricing rules with negative prices", async () => {
    const { app, createPricingRule } = createMockController();

    const response = await request(app)
      .post(`/api/admin/courts/${courtId}/pricing-rules`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({
        startTime: "08:00",
        endTime: "10:00",
        priceAmount: -1
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(createPricingRule).not.toHaveBeenCalled();
  });

  it("does not expose hard-delete routes for courts or court types", async () => {
    const { app } = createMockController();

    const courtResponse = await request(app)
      .delete(`/api/admin/courts/${courtId}`)
      .set("Authorization", bearerToken(["ADMIN"]));
    const courtTypeResponse = await request(app)
      .delete(`/api/admin/court-types/${courtTypeId}`)
      .set("Authorization", bearerToken(["ADMIN"]));

    expect(courtResponse.status).toBe(404);
    expect(courtResponse.body.error.code).toBe("NOT_FOUND");
    expect(courtTypeResponse.status).toBe(404);
    expect(courtTypeResponse.body.error.code).toBe("NOT_FOUND");
  });
});
