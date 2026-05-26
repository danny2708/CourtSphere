import type { Request, Response } from "express";

import { notificationsService, type NotificationsService } from "./notifications.service";
import type { ListMyNotificationsQuery } from "./notifications.types";

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string") {
    throw new Error(`Expected route parameter '${key}'`);
  }

  return value;
}

export class NotificationsController {
  constructor(private readonly service: NotificationsService = notificationsService) {}

  listMyNotifications = async (req: Request, res: Response): Promise<void> => {
    const notifications = await this.service.listMyNotifications(
      req.user!.id,
      req.query as unknown as ListMyNotificationsQuery
    );

    res.status(200).json({ notifications });
  };

  markAsRead = async (req: Request, res: Response): Promise<void> => {
    const notification = await this.service.markAsRead(req.user!.id, routeParam(req, "id"));

    res.status(200).json({ notification });
  };

  markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.markAllAsRead(req.user!.id);

    res.status(200).json({ updatedCount: result.count });
  };

  getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.getUnreadCount(req.user!.id);

    res.status(200).json(result);
  };
}

export const notificationsController = new NotificationsController();

