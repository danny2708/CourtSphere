import { PaymentStatus } from "@prisma/client";
import { z } from "zod";

const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected a valid ISO datetime")
  .transform((value) => new Date(value));

const momoStringValueSchema = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((value) => String(value));

export const bookingPaymentParamsSchema = z.object({
  id: z.string().uuid()
});

export const paymentIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const createPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["MOCK", "MOMO"]).optional()
});

export const mockPaymentCallbackSchema = z.object({
  gatewayTransactionId: z.string().trim().min(1),
  status: z.enum([
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED
  ]),
  signature: z.string().trim().min(1)
});

export const momoPaymentCallbackSchema = z
  .object({
    partnerCode: momoStringValueSchema,
    orderId: momoStringValueSchema,
    requestId: momoStringValueSchema,
    amount: momoStringValueSchema,
    orderInfo: momoStringValueSchema,
    orderType: momoStringValueSchema,
    transId: momoStringValueSchema,
    resultCode: momoStringValueSchema,
    message: momoStringValueSchema,
    payType: momoStringValueSchema,
    responseTime: momoStringValueSchema,
    extraData: momoStringValueSchema.default(""),
    signature: z.string().trim().min(1)
  })
  .passthrough();

export const adminListPaymentsQuerySchema = z
  .object({
    status: z.enum(PaymentStatus).optional(),
    fromDate: isoDateTimeSchema.optional(),
    toDate: isoDateTimeSchema.optional(),
    bookingCode: z.string().trim().min(1).max(100).optional(),
    userId: z.string().uuid().optional()
  })
  .refine(
    (value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate,
    {
      message: "fromDate must be earlier than or equal to toDate",
      path: ["toDate"]
    }
  );
