import type { Request, Response } from "express";

import type {
  AdminListRefundsQuery,
  AuditContext,
  ManagerCancelBookingInput,
  RetryRefundInput
} from "./refunds.types";
import { refundsService, type RefundsService } from "./refunds.service";

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

export class RefundsController {
  constructor(private readonly service: RefundsService = refundsService) {}

  listRefundsForAdmin = async (req: Request, res: Response): Promise<void> => {
    const refunds = await this.service.listRefundsForAdmin(
      req.query as unknown as AdminListRefundsQuery
    );

    res.status(200).json({ refunds });
  };

  getRefundDetailForAdmin = async (req: Request, res: Response): Promise<void> => {
    const refund = await this.service.getRefundDetailForAdmin(routeParam(req, "id"));

    res.status(200).json({ refund });
  };

  retryRefund = async (req: Request, res: Response): Promise<void> => {
    const refund = await this.service.retryRefund(
      routeParam(req, "id"),
      req.body as RetryRefundInput,
      auditContext(req)
    );

    res.status(200).json({ refund });
  };

  cancelBookingDueToCourtIssue = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.cancelBookingDueToCourtIssue(
      routeParam(req, "id"),
      req.body as ManagerCancelBookingInput,
      auditContext(req)
    );

    res.status(200).json(result);
  };
}

export const refundsController = new RefundsController();
