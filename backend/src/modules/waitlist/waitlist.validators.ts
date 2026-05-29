import { WaitlistStatus } from "@prisma/client";
import { z } from "zod";

const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected a valid ISO datetime")
  .transform((value) => new Date(value));

export const waitlistEntryIdParamSchema = z.object({
  id: z.string().uuid()
});

export const joinWaitlistSchema = z
  .object({
    courtId: z.string().uuid(),
    startDatetime: isoDateTimeSchema,
    endDatetime: isoDateTimeSchema
  })
  .refine((value) => value.startDatetime < value.endDatetime, {
    message: "startDatetime must be earlier than endDatetime",
    path: ["endDatetime"]
  });

export const listMyWaitlistQuerySchema = z
  .object({
    status: z.enum(WaitlistStatus).optional(),
    fromDate: isoDateTimeSchema.optional(),
    toDate: isoDateTimeSchema.optional()
  })
  .refine((value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate, {
    message: "fromDate must be earlier than or equal to toDate",
    path: ["toDate"]
  });
