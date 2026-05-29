import { NotificationType } from "@prisma/client";
import { z } from "zod";

function optionalBooleanQuery(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return value as boolean;
}

export const listMyNotificationsQuerySchema = z.object({
  isRead: z.preprocess(optionalBooleanQuery, z.boolean().optional()),
  type: z.enum(NotificationType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid()
});

