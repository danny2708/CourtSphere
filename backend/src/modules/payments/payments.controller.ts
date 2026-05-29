import type { Request, Response } from "express";

import type {
  AdminListPaymentsQuery,
  CreatePaymentInput,
  MockPaymentCallbackInput,
  MomoPaymentCallbackInput
} from "./payments.types";
import { paymentsService, type PaymentsService } from "./payments.service";

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string") {
    throw new Error(`Expected route parameter '${key}'`);
  }

  return value;
}

export class PaymentsController {
  constructor(private readonly service: PaymentsService = paymentsService) {}

  createPaymentForBooking = async (req: Request, res: Response): Promise<void> => {
    const payment = await this.service.createPaymentForBooking(
      req.user!.id,
      routeParam(req, "id"),
      req.body as CreatePaymentInput
    );

    res.status(201).json({ payment });
  };

  handleMockCallback = async (req: Request, res: Response): Promise<void> => {
    const payment = await this.service.handleMockCallback(req.body as MockPaymentCallbackInput);

    res.status(200).json({ payment });
  };

  handleMomoCallback = async (req: Request, res: Response): Promise<void> => {
    const payment = await this.service.handleMomoCallback(req.body as MomoPaymentCallbackInput);

    res.status(200).json({ payment });
  };

  getPaymentDetail = async (req: Request, res: Response): Promise<void> => {
    const payment = await this.service.getPaymentDetail(
      { userId: req.user!.id, roles: req.user!.roles },
      routeParam(req, "id")
    );

    res.status(200).json({ payment });
  };

  listPaymentsForAdmin = async (req: Request, res: Response): Promise<void> => {
    const payments = await this.service.listPaymentsForAdmin(
      req.query as unknown as AdminListPaymentsQuery
    );

    res.status(200).json({ payments });
  };
}

export const paymentsController = new PaymentsController();
