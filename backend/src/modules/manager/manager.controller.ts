import type { Request, Response } from "express";

import type {
  AuditContext,
  ManagerNoShowInput,
  ManagerReasonInput,
  ManagerTodayScheduleQuery
} from "./manager.types";
import { managerService, type ManagerService } from "./manager.service";

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
    roles: req.user!.roles,
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  };
}

export class ManagerController {
  constructor(private readonly service: ManagerService = managerService) {}

  getTodaySchedule = async (req: Request, res: Response): Promise<void> => {
    const bookingItems = await this.service.getTodaySchedule(
      req.query as unknown as ManagerTodayScheduleQuery
    );

    res.status(200).json({ bookingItems });
  };

  checkInBookingItem = async (req: Request, res: Response): Promise<void> => {
    const bookingItem = await this.service.checkInBookingItem(
      routeParam(req, "id"),
      auditContext(req)
    );

    res.status(200).json({ bookingItem });
  };

  overrideLateCheckin = async (req: Request, res: Response): Promise<void> => {
    const bookingItem = await this.service.overrideLateCheckin(
      routeParam(req, "id"),
      req.body as ManagerReasonInput,
      auditContext(req)
    );

    res.status(200).json({ bookingItem });
  };

  markNoShow = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.markNoShow(
      routeParam(req, "id"),
      req.body as ManagerNoShowInput,
      auditContext(req)
    );

    res.status(200).json(result);
  };

  overrideComplete = async (req: Request, res: Response): Promise<void> => {
    const bookingItem = await this.service.overrideComplete(
      routeParam(req, "id"),
      req.body as ManagerReasonInput,
      auditContext(req)
    );

    res.status(200).json({ bookingItem });
  };
}

export const managerController = new ManagerController();
