import { z } from "zod";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Invalid calendar date");

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

export const availabilityParamsSchema = z.object({
  id: z.string().uuid()
});

export const availabilityQuerySchema = z.object({
  date: dateOnlySchema,
  durationMinutes: z.coerce.number().int().positive().max(1440).optional(),
  includePricing: optionalBooleanSchema
});
