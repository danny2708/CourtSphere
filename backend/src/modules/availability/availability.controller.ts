import type { Request, Response } from "express";

import type { AvailabilityQuery } from "./availability.types";
import { availabilityService, type AvailabilityService } from "./availability.service";

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string") {
    throw new Error(`Expected route parameter '${key}'`);
  }

  return value;
}

export class AvailabilityController {
  constructor(private readonly service: AvailabilityService = availabilityService) {}

  getCourtAvailability = async (req: Request, res: Response): Promise<void> => {
    const availability = await this.service.getCourtAvailability(
      routeParam(req, "id"),
      req.user!.id,
      req.query as unknown as AvailabilityQuery
    );

    res.status(200).json(availability);
  };
}

export const availabilityController = new AvailabilityController();
