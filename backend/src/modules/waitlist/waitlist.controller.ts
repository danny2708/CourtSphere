import type { Request, Response } from "express";

import type { JoinWaitlistInput, ListMyWaitlistQuery } from "./waitlist.types";
import { waitlistService, type WaitlistService } from "./waitlist.service";

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string") {
    throw new Error(`Expected route parameter '${key}'`);
  }

  return value;
}

export class WaitlistController {
  constructor(private readonly service: WaitlistService = waitlistService) {}

  joinWaitlist = async (req: Request, res: Response): Promise<void> => {
    const waitlistEntry = await this.service.joinWaitlist(
      req.user!.id,
      req.body as JoinWaitlistInput
    );

    res.status(201).json({ waitlistEntry });
  };

  getMyWaitlist = async (req: Request, res: Response): Promise<void> => {
    const waitlistEntries = await this.service.getMyWaitlist(
      req.user!.id,
      req.query as unknown as ListMyWaitlistQuery
    );

    res.status(200).json({ waitlistEntries });
  };

  cancelWaitlist = async (req: Request, res: Response): Promise<void> => {
    const waitlistEntry = await this.service.cancelWaitlist(req.user!.id, routeParam(req, "id"));

    res.status(200).json({ waitlistEntry });
  };

  bookFromWaitlist = async (req: Request, res: Response): Promise<void> => {
    const booking = await this.service.bookFromWaitlist(req.user!.id, {
      waitlistEntryId: routeParam(req, "id")
    });

    res.status(201).json({ booking });
  };
}

export const waitlistController = new WaitlistController();
