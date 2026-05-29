import { BookingStatus } from "@prisma/client";
import { z } from "zod";

const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected a valid ISO datetime")
  .transform((value) => new Date(value));

export const bookingOrderIdParamSchema = z.object({
  id: z.string().uuid()
});

const createBookingItemSchema = z
  .object({
    courtId: z.string().uuid(),
    startDatetime: isoDateTimeSchema,
    endDatetime: isoDateTimeSchema
  })
  .refine((value) => value.startDatetime < value.endDatetime, {
    message: "startDatetime must be earlier than endDatetime",
    path: ["endDatetime"]
  });

export const createBookingSchema = z
  .object({
    items: z.array(createBookingItemSchema).min(1).max(20),
    note: z.string().trim().min(1).max(500).optional()
  })
  .refine((value) => {
    const keys = value.items.map(
      (item) => `${item.courtId}:${item.startDatetime.toISOString()}:${item.endDatetime.toISOString()}`
    );
    return new Set(keys).size === keys.length;
  }, {
    message: "Duplicate booking items are not allowed",
    path: ["items"]
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

