import type { Request, Response } from "express";

import type {
  AdminListUsersQuery,
  AdminRoleInput,
  AdminUpdateAccountStatusInput,
  AdminUpdateBookingPermissionInput,
  AdminUpdatePriorityGroupInput,
  AdminUpdateUserProfileInput,
  AuditContext
} from "./users.types";
import { usersService, type UsersService } from "./users.service";

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string") {
    throw new Error(`Expected route parameter '${key}'`);
  }

  return value;
}

function auditContext(req: Request): AuditContext {
  return {
    actorUserId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  };
}

export class UsersController {
  constructor(private readonly service: UsersService = usersService) {}

  listUsers = async (req: Request, res: Response): Promise<void> => {
    const users = await this.service.listUsers(req.query as AdminListUsersQuery);
    res.status(200).json({ users });
  };

  updateUserProfile = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.updateUserProfile(
      routeParam(req, "id"),
      req.body as AdminUpdateUserProfileInput,
      auditContext(req)
    );
    res.status(200).json({ user });
  };

  assignRole = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.assignRole(
      routeParam(req, "id"),
      req.body as AdminRoleInput,
      auditContext(req)
    );
    res.status(200).json({ user });
  };

  removeRole = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.removeRole(
      routeParam(req, "id"),
      { roleName: routeParam(req, "roleName") as AdminRoleInput["roleName"] },
      auditContext(req)
    );
    res.status(200).json({ user });
  };

  updateAccountStatus = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.updateAccountStatus(
      routeParam(req, "id"),
      req.body as AdminUpdateAccountStatusInput,
      auditContext(req)
    );
    res.status(200).json({ user });
  };

  updateBookingPermission = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.updateBookingPermission(
      routeParam(req, "id"),
      req.body as AdminUpdateBookingPermissionInput,
      auditContext(req)
    );
    res.status(200).json({ user });
  };

  updatePriorityGroup = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.updatePriorityGroup(
      routeParam(req, "id"),
      req.body as AdminUpdatePriorityGroupInput,
      auditContext(req)
    );
    res.status(200).json({ user });
  };
}

export const usersController = new UsersController();
