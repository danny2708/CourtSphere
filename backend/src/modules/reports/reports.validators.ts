import { z } from "zod";

const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected a valid ISO datetime")
  .transform((value) => new Date(value));

const dateRangeSchema = z
  .object({
    fromDate: isoDateTimeSchema.optional(),
    toDate: isoDateTimeSchema.optional()
  })
  .refine((value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate, {
    message: "fromDate must be earlier than or equal to toDate",
    path: ["toDate"]
  });

export const reportsDateRangeQuerySchema = dateRangeSchema;

export const groupedReportsQuerySchema = dateRangeSchema.extend({
  groupBy: z.enum(["day", "month"]).default("day")
});

export const violatingUsersReportQuerySchema = dateRangeSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(10)
});
