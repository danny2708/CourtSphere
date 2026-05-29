import type { Request, Response } from "express";

import type {
  CancelBookingInput,
  CreateBookingInput,
  ListMyBookingsQuery
} from "./bookings.types";
import { bookingsService, type BookingsService } from "./bookings.service";

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string") {
    throw new Error(`Expected route parameter '${key}'`);
  }

  return value;
}

export class BookingsController {
  constructor(private readonly service: BookingsService = bookingsService) {}

  createBookingHold = async (req: Request, res: Response): Promise<void> => {
    const booking = await this.service.createBookingHold(
      req.user!.id,
      req.body as CreateBookingInput
    );

    res.status(201).json({ booking });
  };

  listMyBookings = async (req: Request, res: Response): Promise<void> => {
    const bookings = await this.service.listMyBookings(
      req.user!.id,
      req.query as unknown as ListMyBookingsQuery
    );

    res.status(200).json({ bookings });
  };

  getBookingDetail = async (req: Request, res: Response): Promise<void> => {
    const booking = await this.service.getBookingDetail(req.user!.id, routeParam(req, "id"));

    res.status(200).json({ booking });
  };

  cancelMyBooking = async (req: Request, res: Response): Promise<void> => {
    const booking = await this.service.cancelMyBooking(
      req.user!.id,
      routeParam(req, "id"),
      req.body as CancelBookingInput
    );

    res.status(200).json({ booking });
  };
}

export const bookingsController = new BookingsController();

