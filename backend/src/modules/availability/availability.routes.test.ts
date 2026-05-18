import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middlewares/error.middleware";
import { TokenService } from "../auth/services/token.service";
import { AvailabilityController } from "./availability.controller";
import { createAvailabilityRouter } from "./availability.routes";

const userId = "00000000-0000-4000-8000-000000000401";
const courtId = "00000000-0000-4000-8000-000000000402";
const tokenService = new TokenService();

function bearerToken(): string {
  return `Bearer ${tokenService.createAccessToken({
    userId,
    email: "user@example.edu",
    roles: ["USER"]
  })}`;
}

function createMockController() {
  const controller = new AvailabilityController();

  controller.getCourtAvailability = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      court: {
        id: courtId
      },
      slots: []
    });
  });

  return controller;
}

function createTestApp(controller: AvailabilityController) {
  const app = express();
  app.use(express.json());
  app.use("/api", createAvailabilityRouter(controller));
  app.use(errorHandler);
  return app;
}

describe("availability routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an authenticated user to request court availability", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get(`/api/courts/${courtId}/availability`)
      .query({ date: "2026-05-20", durationMinutes: 60, includePricing: "true" })
      .set("Authorization", bearerToken());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      court: {
        id: courtId
      },
      slots: []
    });
    expect(controller.getCourtAvailability).toHaveBeenCalledOnce();
  });

  it("rejects requests without date", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get(`/api/courts/${courtId}/availability`)
      .set("Authorization", bearerToken());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(controller.getCourtAvailability).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const controller = createMockController();
    const app = createTestApp(controller);

    const response = await request(app)
      .get(`/api/courts/${courtId}/availability`)
      .query({ date: "2026-05-20" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
    expect(controller.getCourtAvailability).not.toHaveBeenCalled();
  });
});
