import { RefundStatus } from "@prisma/client";
import { z } from "zod";

const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected a valid ISO datetime")
  .transform((value) => new Date(value));

export const refundIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const managerCancelBookingParamsSchema = z.object({
  id: z.string().uuid()
});

export const adminListRefundsQuerySchema = z
  .object({
    refundStatus: z.enum(RefundStatus).optional(),
    fromDate: isoDateTimeSchema.optional(),
    toDate: isoDateTimeSchema.optional(),
    bookingCode: z.string().trim().min(1).max(100).optional(),
    userId: z.string().uuid().optional(),
    paymentId: z.string().uuid().optional()
  })
  .refine(
    (value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate,
    {
      message: "fromDate must be earlier than or equal to toDate",
      path: ["toDate"]
    }
  );

export const retryRefundSchema = z.object({
  mockResult: z
    .enum([RefundStatus.SUCCESS, RefundStatus.FAILED, RefundStatus.MANUAL_REVIEW])
    .optional(),
  reason: z.string().trim().min(1).max(500).optional()
});

export const managerCancelBookingSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});
