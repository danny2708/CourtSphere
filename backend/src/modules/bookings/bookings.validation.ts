import { BookingStatus } from "@prisma/client";
import { z } from "zod";

const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected a valid ISO datetime")
  .transform((value) => new Date(value));

export const bookingIdParamSchema = z.object({
  id: z.string().uuid()
});

export const createBookingSchema = z
  .object({
    courtId: z.string().uuid(),
    startDatetime: isoDateTimeSchema,
    endDatetime: isoDateTimeSchema,
    participantCount: z.coerce.number().int().positive(),
    usagePurpose: z.string().trim().min(3).max(500)
  })
  .refine((value) => value.startDatetime < value.endDatetime, {
    message: "startDatetime must be earlier than endDatetime",
    path: ["endDatetime"]
  });

export const listMyBookingsQuerySchema = z
  .object({
    status: z.enum(BookingStatus).optional(),
    fromDate: isoDateTimeSchema.optional(),
    toDate: isoDateTimeSchema.optional()
  })
  .refine(
    (value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate,
    {
      message: "fromDate must be earlier than or equal to toDate",
      path: ["toDate"]
    }
  );

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional()
});

