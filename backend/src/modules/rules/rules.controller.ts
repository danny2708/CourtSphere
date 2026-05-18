import type { Request, Response } from "express";

import type {
  AuditContext,
  BookingRulesInput,
  PriorityGroupInput,
  PriorityPolicyInput
} from "./rules.types";
import { rulesService, type RulesService } from "./rules.service";

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

export class RulesController {
  constructor(private readonly service: RulesService = rulesService) {}

  getBookingRules = async (_req: Request, res: Response): Promise<void> => {
    const bookingRules = await this.service.getBookingRules();
    res.status(200).json({ bookingRules });
  };

  updateBookingRules = async (req: Request, res: Response): Promise<void> => {
    const bookingRules = await this.service.updateBookingRules(
      req.body as BookingRulesInput,
      auditContext(req)
    );
    res.status(200).json({ bookingRules });
  };

  listPriorityGroups = async (_req: Request, res: Response): Promise<void> => {
    const priorityGroups = await this.service.listPriorityGroups();
    res.status(200).json({ priorityGroups });
  };

  updatePriorityGroup = async (req: Request, res: Response): Promise<void> => {
    const priorityGroup = await this.service.updatePriorityGroup(
      routeParam(req, "id"),
      req.body as PriorityGroupInput,
      auditContext(req)
    );
    res.status(200).json({ priorityGroup });
  };

  listPriorityPolicies = async (_req: Request, res: Response): Promise<void> => {
    const priorityPolicies = await this.service.listPriorityPolicies();
    res.status(200).json({ priorityPolicies });
  };

  updatePriorityPolicy = async (req: Request, res: Response): Promise<void> => {
    const priorityPolicy = await this.service.updatePriorityPolicy(
      routeParam(req, "id"),
      req.body as PriorityPolicyInput,
      auditContext(req)
    );
    res.status(200).json({ priorityPolicy });
  };
}

export const rulesController = new RulesController();
