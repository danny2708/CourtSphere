import type { Request, Response } from "express";

import type {
  ActorContext,
  CreateCourtInput,
  CreateCourtTypeInput,
  CreateOperatingHourInput,
  CreatePricingRuleInput,
  ListCourtsQuery,
  UpdateCourtInput,
  UpdateCourtManagersInput,
  UpdateCourtStatusInput,
  UpdateCourtTypeInput,
  UpdateEntityStatusInput,
  UpdateOperatingHourInput,
  UpdatePricingRuleInput
} from "./courts.types";
import { courtsService, type CourtsService } from "./courts.service";

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string") {
    throw new Error(`Expected route parameter '${key}'`);
  }

  return value;
}

function actorContext(req: Request): ActorContext {
  return {
    actorUserId: req.user!.id,
    roles: req.user!.roles
  };
}

export class CourtsController {
  constructor(private readonly service: CourtsService = courtsService) {}

  listCourtTypes = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ courtTypes: await this.service.listCourtTypes() });
  };

  createCourtType = async (req: Request, res: Response): Promise<void> => {
    const courtType = await this.service.createCourtType(req.body as CreateCourtTypeInput);
    res.status(201).json({ courtType });
  };

  updateCourtType = async (req: Request, res: Response): Promise<void> => {
    const courtType = await this.service.updateCourtType(routeParam(req, "id"), req.body as UpdateCourtTypeInput);
    res.status(200).json({ courtType });
  };

  updateCourtTypeStatus = async (req: Request, res: Response): Promise<void> => {
    const courtType = await this.service.updateCourtTypeStatus(
      routeParam(req, "id"),
      req.body as UpdateEntityStatusInput
    );
    res.status(200).json({ courtType });
  };

  listCourts = async (req: Request, res: Response): Promise<void> => {
    const courts = await this.service.listCourts(req.query as ListCourtsQuery, actorContext(req));
    res.status(200).json({ courts });
  };

  getCourtDetail = async (req: Request, res: Response): Promise<void> => {
    const court = await this.service.getCourtDetail(routeParam(req, "id"));
    res.status(200).json({ court });
  };

  createCourt = async (req: Request, res: Response): Promise<void> => {
    const court = await this.service.createCourt(req.body as CreateCourtInput);
    res.status(201).json({ court });
  };

  updateCourt = async (req: Request, res: Response): Promise<void> => {
    const court = await this.service.updateCourt(
      routeParam(req, "id"),
      req.body as UpdateCourtInput,
      actorContext(req)
    );
    res.status(200).json({ court });
  };

  updateCourtStatus = async (req: Request, res: Response): Promise<void> => {
    const court = await this.service.updateCourtStatus(
      routeParam(req, "id"),
      actorContext(req),
      req.body as UpdateCourtStatusInput
    );
    res.status(200).json({ court });
  };

  updateCourtManagers = async (req: Request, res: Response): Promise<void> => {
    const court = await this.service.updateCourtManagers(
      routeParam(req, "id"),
      req.user!.id,
      req.body as UpdateCourtManagersInput
    );
    res.status(200).json({ court });
  };

  listOperatingHours = async (req: Request, res: Response): Promise<void> => {
    const operatingHours = await this.service.listOperatingHours(routeParam(req, "courtId"), actorContext(req));
    res.status(200).json({ operatingHours });
  };

  createOperatingHour = async (req: Request, res: Response): Promise<void> => {
    const operatingHour = await this.service.createOperatingHour(
      routeParam(req, "courtId"),
      req.body as CreateOperatingHourInput,
      actorContext(req)
    );
    res.status(201).json({ operatingHour });
  };

  updateOperatingHour = async (req: Request, res: Response): Promise<void> => {
    const operatingHour = await this.service.updateOperatingHour(
      routeParam(req, "id"),
      req.body as UpdateOperatingHourInput,
      actorContext(req)
    );
    res.status(200).json({ operatingHour });
  };

  updateOperatingHourStatus = async (req: Request, res: Response): Promise<void> => {
    const operatingHour = await this.service.updateOperatingHourStatus(
      routeParam(req, "id"),
      req.body as UpdateEntityStatusInput,
      actorContext(req)
    );
    res.status(200).json({ operatingHour });
  };

  deleteOperatingHour = async (req: Request, res: Response): Promise<void> => {
    const operatingHour = await this.service.deleteOperatingHour(routeParam(req, "id"), actorContext(req));
    res.status(200).json({ operatingHour });
  };

  listPricingRules = async (req: Request, res: Response): Promise<void> => {
    const pricingRules = await this.service.listPricingRules(routeParam(req, "courtId"), actorContext(req));
    res.status(200).json({ pricingRules });
  };

  createPricingRule = async (req: Request, res: Response): Promise<void> => {
    const pricingRule = await this.service.createPricingRule(
      routeParam(req, "courtId"),
      actorContext(req),
      req.body as CreatePricingRuleInput
    );
    res.status(201).json({ pricingRule });
  };

  updatePricingRule = async (req: Request, res: Response): Promise<void> => {
    const pricingRule = await this.service.updatePricingRule(
      routeParam(req, "id"),
      req.body as UpdatePricingRuleInput,
      actorContext(req)
    );
    res.status(200).json({ pricingRule });
  };

  updatePricingRuleStatus = async (req: Request, res: Response): Promise<void> => {
    const pricingRule = await this.service.updatePricingRuleStatus(
      routeParam(req, "id"),
      req.body as UpdateEntityStatusInput,
      actorContext(req)
    );
    res.status(200).json({ pricingRule });
  };

  deletePricingRule = async (req: Request, res: Response): Promise<void> => {
    const pricingRule = await this.service.deletePricingRule(routeParam(req, "id"), actorContext(req));
    res.status(200).json({ pricingRule });
  };
}

export const courtsController = new CourtsController();
