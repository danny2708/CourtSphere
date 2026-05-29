import { BookingStatus } from "@prisma/client";
import { z } from "zod";

export const bookingItemIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const managerTodayScheduleQuerySchema = z.object({
  courtId: z.string().uuid().optional(),
  status: z.enum(BookingStatus).optional()
});

export const managerReasonSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

export const managerNoShowSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional()
});
