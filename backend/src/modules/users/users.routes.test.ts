import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler, notFoundHandler } from "../../middlewares/error.middleware";
import { CourtsController } from "../courts/courts.controller";
import { createCourtsRouter } from "../courts/courts.routes";
import { TokenService } from "../auth/services/token.service";
import { UsersController } from "./users.controller";
import { createUsersRouter } from "./users.routes";

const userId = "00000000-0000-4000-8000-000000000101";
const targetUserId = "00000000-0000-4000-8000-000000000102";
const courtId = "00000000-0000-4000-8000-000000000103";
const priorityGroupId = "00000000-0000-4000-8000-000000000104";

const tokenService = new TokenService();

function bearerToken(roles: string[]): string {
  return `Bearer ${tokenService.createAccessToken({
    userId,
    email: "actor@example.edu",
    roles
  })}`;
}

function createMockUsersController() {
  const controller = new UsersController();

  controller.listUsers = vi.fn(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ users: [] });
  });
  controller.updateUserProfile = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ user: { id: req.params.id, fullName: req.body.fullName } });
  });
  controller.assignRole = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ user: { id: req.params.id, roles: ["USER", req.body.roleName] } });
  });
  controller.removeRole = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ user: { id: req.params.id, removedRole: req.params.roleName } });
  });
  controller.updateAccountStatus = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ user: { id: req.params.id, accountStatus: req.body.accountStatus } });
  });
  controller.updateBookingPermission = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      user: {
        id: req.params.id,
        bookingPermissionStatus: req.body.bookingPermissionStatus
      }
    });
  });
  controller.updatePriorityGroup = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ user: { id: req.params.id, priorityGroupId: req.body.priorityGroupId } });
  });

  return controller;
}

function createMockCourtsController() {
  const controller = new CourtsController();

  controller.updateCourtStatus = vi.fn(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ court: { id: req.params.id, status: req.body.status } });
  });

  return controller;
}

function createTestApp(usersController: UsersController, courtsController: CourtsController) {
  const app = express();
  app.use(express.json());
  app.use("/api", createCourtsRouter(courtsController));
  app.use("/api/admin", createUsersRouter(usersController));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("admin users routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN to list and manage users", async () => {
    const usersController = createMockUsersController();
    const app = createTestApp(usersController, createMockCourtsController());

    const listResponse = await request(app)
      .get("/api/admin/users")
      .set("Authorization", bearerToken(["ADMIN"]));
    const updateResponse = await request(app)
      .put(`/api/admin/users/${targetUserId}`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ fullName: "Updated User" });
    const assignRoleResponse = await request(app)
      .post(`/api/admin/users/${targetUserId}/roles`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ roleName: "FIELD_MANAGER" });
    const removeRoleResponse = await request(app)
      .delete(`/api/admin/users/${targetUserId}/roles/FIELD_MANAGER`)
      .set("Authorization", bearerToken(["ADMIN"]));
    const accountStatusResponse = await request(app)
      .patch(`/api/admin/users/${targetUserId}/account-status`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ accountStatus: "LOCKED", reason: "Policy violation" });
    const bookingPermissionResponse = await request(app)
      .patch(`/api/admin/users/${targetUserId}/booking-permission`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ bookingPermissionStatus: "RESTRICTED", reason: "Too many violations" });
    const priorityGroupResponse = await request(app)
      .patch(`/api/admin/users/${targetUserId}/priority-group`)
      .set("Authorization", bearerToken(["ADMIN"]))
      .send({ priorityGroupId, reason: "Verified staff" });

    expect(listResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(assignRoleResponse.status).toBe(200);
    expect(removeRoleResponse.status).toBe(200);
    expect(accountStatusResponse.status).toBe(200);
    expect(bookingPermissionResponse.status).toBe(200);
    expect(priorityGroupResponse.status).toBe(200);
    expect(usersController.listUsers).toHaveBeenCalledOnce();
    expect(usersController.updateUserProfile).toHaveBeenCalledOnce();
    expect(usersController.assignRole).toHaveBeenCalledOnce();
    expect(usersController.removeRole).toHaveBeenCalledOnce();
    expect(usersController.updateAccountStatus).toHaveBeenCalledOnce();
    expect(usersController.updateBookingPermission).toHaveBeenCalledOnce();
    expect(usersController.updatePriorityGroup).toHaveBeenCalledOnce();
  });

  it("forbids a normal USER from admin user APIs", async () => {
    const usersController = createMockUsersController();
    const app = createTestApp(usersController, createMockCourtsController());

    const response = await request(app)
      .get("/api/admin/users")
      .set("Authorization", bearerToken(["USER"]));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(usersController.listUsers).not.toHaveBeenCalled();
  });

  it("allows FIELD_MANAGER on manager-permitted route but blocks admin-only users route", async () => {
    const usersController = createMockUsersController();
    const courtsController = createMockCourtsController();
    const app = createTestApp(usersController, courtsController);

    const managerResponse = await request(app)
      .patch(`/api/admin/courts/${courtId}/status`)
      .set("Authorization", bearerToken(["FIELD_MANAGER"]))
      .send({ status: "MAINTENANCE", reason: "Repair" });
    const adminOnlyResponse = await request(app)
      .get("/api/admin/users")
      .set("Authorization", bearerToken(["FIELD_MANAGER"]));

    expect(managerResponse.status).toBe(200);
    expect(courtsController.updateCourtStatus).toHaveBeenCalledOnce();
    expect(adminOnlyResponse.status).toBe(403);
    expect(adminOnlyResponse.body.error.code).toBe("FORBIDDEN");
    expect(usersController.listUsers).not.toHaveBeenCalled();
  });
});
