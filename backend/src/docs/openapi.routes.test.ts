import request from "supertest";
import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import { app } from "../app";

describe("OpenAPI documentation routes", () => {
  it("serves the OpenAPI JSON contract", async () => {
    const response = await request(app).get("/openapi.json");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.info).toMatchObject({
      title: "CourtSphere API",
      version: packageJson.version
    });
    expect(response.body.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT"
    });
    expect(response.body.tags.map((tag: { name: string }) => tag.name)).toEqual([
      "Auth",
      "Courts",
      "Availability",
      "Bookings",
      "Payments",
      "Refunds",
      "Waitlist",
      "Notifications",
      "Manager",
      "Violations",
      "Reports"
    ]);
    expect(response.body.paths).toHaveProperty("/api/admin/reports/overview");
  });

  it("serves Swagger UI", async () => {
    const response = await request(app).get("/api-docs/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("swagger-ui-bundle.js");
    expect(response.text).toContain("id=\"swagger-ui\"");
    expect(response.text).toContain("CourtSphere API Docs");
  });
});
