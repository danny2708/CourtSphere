import { CourtStatus, EntityStatus } from "@prisma/client";
import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm time");

const uuidParamSchema = z.object({
  id: z.string().uuid()
});

export const idParamSchema = uuidParamSchema;

export const courtIdParamSchema = z.object({
  courtId: z.string().uuid()
});

export const listCourtsQuerySchema = z.object({
  keyword: z.string().trim().min(1).max(100).optional(),
  courtTypeId: z.string().uuid().optional(),
  status: z.enum(CourtStatus).optional(),
  location: z.string().trim().min(1).max(100).optional()
});

export const createCourtTypeSchema = z.object({
  typeName: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional()
});

export const updateCourtTypeSchema = createCourtTypeSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

export const updateEntityStatusSchema = z.object({
  status: z.enum(EntityStatus)
});

export const createCourtSchema = z.object({
  courtTypeId: z.string().uuid(),
  courtName: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(255),
  capacity: z.coerce.number().int().positive(),
  description: z.string().trim().max(1000).optional(),
  imageUrl: z.string().trim().url().optional()
});

export const updateCourtSchema = createCourtSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

export const updateCourtStatusSchema = z.object({
  status: z.enum(CourtStatus),
  reason: z.string().trim().max(500).optional()
});

const operatingHourBaseSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  openTime: timeSchema,
  closeTime: timeSchema,
  slotDurationMinutes: z.coerce.number().int().positive()
});

export const createOperatingHourSchema = operatingHourBaseSchema
  .refine((value) => value.openTime < value.closeTime, {
    message: "openTime must be earlier than closeTime",
    path: ["openTime"]
  });

export const updateOperatingHourSchema = operatingHourBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")
  .refine(
    (value) => {
      if (!value.openTime || !value.closeTime) {
        return true;
      }

      return value.openTime < value.closeTime;
    },
    {
      message: "openTime must be earlier than closeTime",
      path: ["openTime"]
    }
  );

const pricingRuleBaseSchema = z.object({
  startTime: timeSchema,
  endTime: timeSchema,
  applicableDay: z.coerce.number().int().min(1).max(7).optional(),
  priceAmount: z.coerce.number().min(0).transform((value) => value.toFixed(2)),
  priorityGroupId: z.string().uuid().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional()
});

export const createPricingRuleSchema = pricingRuleBaseSchema
  .refine((value) => value.startTime < value.endTime, {
    message: "startTime must be earlier than endTime",
    path: ["startTime"]
  })
  .refine(
    (value) => {
      if (!value.effectiveFrom || !value.effectiveTo) {
        return true;
      }

      return value.effectiveFrom <= value.effectiveTo;
    },
    {
      message: "effectiveFrom must be earlier than or equal to effectiveTo",
      path: ["effectiveFrom"]
    }
  );

export const updatePricingRuleSchema = pricingRuleBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")
  .refine(
    (value) => {
      if (!value.startTime || !value.endTime) {
        return true;
      }

      return value.startTime < value.endTime;
    },
    {
      message: "startTime must be earlier than endTime",
      path: ["startTime"]
    }
  )
  .refine(
    (value) => {
      if (!value.effectiveFrom || !value.effectiveTo) {
        return true;
      }

      return value.effectiveFrom <= value.effectiveTo;
    },
    {
      message: "effectiveFrom must be earlier than or equal to effectiveTo",
      path: ["effectiveFrom"]
    }
  );
