import { ViolationType } from "@prisma/client";
import { z } from "zod";

const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected a valid ISO datetime")
  .transform((value) => new Date(value));

const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const violationIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const listViolationsQuerySchema = z
  .object({
    userId: z.string().uuid().optional(),
    violationType: z.enum(ViolationType).optional(),
    isWaived: booleanQuerySchema.optional(),
    fromDate: isoDateTimeSchema.optional(),
    toDate: isoDateTimeSchema.optional(),
    bookingItemId: z.string().uuid().optional()
  })
  .refine((value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate, {
    message: "fromDate must be earlier than or equal to toDate",
    path: ["toDate"]
  });

export const waiveViolationSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

export const adjustViolationPointsSchema = z.object({
  penaltyPoints: z.number().int().min(0),
  reason: z.string().trim().min(3).max(500)
});
