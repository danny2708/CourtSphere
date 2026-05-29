import type { Request, Response } from "express";

import type {
  AdjustViolationPointsInput,
  AuditContext,
  ListViolationsQuery,
  WaiveViolationInput
} from "./violations.types";
import { violationsService, type ViolationsService } from "./violations.service";

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

export class ViolationsController {
  constructor(private readonly service: ViolationsService = violationsService) {}

  listViolations = async (req: Request, res: Response): Promise<void> => {
    const violations = await this.service.listViolations(
      req.query as unknown as ListViolationsQuery
    );

    res.status(200).json({ violations });
  };

  waiveViolation = async (req: Request, res: Response): Promise<void> => {
    const violation = await this.service.waiveViolation(
      routeParam(req, "id"),
      req.body as WaiveViolationInput,
      auditContext(req)
    );

    res.status(200).json({ violation });
  };

  adjustViolationPoints = async (req: Request, res: Response): Promise<void> => {
    const violation = await this.service.adjustViolationPoints(
      routeParam(req, "id"),
      req.body as AdjustViolationPointsInput,
      auditContext(req)
    );

    res.status(200).json({ violation });
  };
}

export const violationsController = new ViolationsController();
