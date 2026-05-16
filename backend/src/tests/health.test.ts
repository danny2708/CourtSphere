import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../app";
import { errorHandler } from "../middlewares/error.middleware";

describe("health route", () => {
  it("returns backend health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "courtsphere-backend",
      environment: "test"
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });
});

describe("fallback error handling", () => {
  it("returns a standard not-found error", async () => {
    const response = await request(app).get("/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route GET /missing not found"
      }
    });
  });

  it("does not expose stack traces for unexpected errors", async () => {
    const testApp = express();

    testApp.get("/boom", () => {
      throw new Error("database password leaked");
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred"
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("database password leaked");
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });
});
