import { EntityStatus } from "@prisma/client";
import { z } from "zod";

const optionalBooleanSchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return value;
}, z.boolean().optional());

export const configIdParamSchema = z.object({
  id: z.string().uuid()
});

export const updateBookingRulesSchema = z
  .object({
    maxBookingsPerDay: z.coerce.number().int().positive().optional(),
    maxDurationMinutes: z.coerce.number().int().positive().optional(),
    holdMinutes: z.coerce.number().int().positive().optional(),
    cancelBeforeHours: z.coerce.number().int().min(0).optional(),
    lateCheckinMinutes: z.coerce.number().int().min(0).optional(),
    violationThreshold: z.coerce.number().int().positive().optional(),
    bookingBanDays: z.coerce.number().int().min(0).optional(),
    refundRateUserOnTime: z.coerce.number().int().min(0).max(100).optional(),
    refundRateManagerFault: z.coerce.number().int().min(0).max(100).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const updatePriorityGroupSchema = z
  .object({
    groupName: z.string().trim().min(2).max(100).optional(),
    groupCode: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[A-Z0-9_]+$/, "groupCode must contain uppercase letters, numbers, or underscores")
      .optional(),
    priorityLevel: z.coerce.number().int().positive().optional(),
    advanceBookingDays: z.coerce.number().int().min(0).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    status: z.enum(EntityStatus).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const updatePriorityPolicySchema = z
  .object({
    priorityGroupId: z.string().uuid().optional(),
    priorityRank: z.coerce.number().int().positive().optional(),
    advanceBookingDays: z.coerce.number().int().min(0).optional(),
    maxBookingsPerDay: z.coerce.number().int().positive().nullable().optional(),
    canJoinWaitlist: optionalBooleanSchema,
    status: z.enum(EntityStatus).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
