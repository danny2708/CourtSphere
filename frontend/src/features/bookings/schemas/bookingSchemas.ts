import { z } from "zod";

const isoDateTimeSchema = z
  .string()
  .trim()
  .min(1, "Thiếu thời gian đặt sân")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Thời gian đặt sân không hợp lệ");

export const createBookingFormSchema = z
  .object({
    courtId: z.string().trim().min(1, "Thiếu thông tin sân"),
    startDatetime: isoDateTimeSchema,
    endDatetime: isoDateTimeSchema,
    note: z
      .string()
      .trim()
      .max(500, "Ghi chú tối đa 500 ký tự")
      .optional()
      .transform((value) => (value ? value : undefined))
  })
  .refine((value) => new Date(value.startDatetime) < new Date(value.endDatetime), {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endDatetime"]
  })
  .refine((value) => new Date(value.startDatetime) > new Date(), {
    message: "Không thể đặt sân trong quá khứ",
    path: ["startDatetime"]
  });

export const cancelBookingFormSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Lý do hủy tối đa 500 ký tự")
    .optional()
    .transform((value) => (value ? value : undefined))
});

export type CreateBookingFormValues = z.infer<typeof createBookingFormSchema>;
export type CancelBookingFormValues = z.infer<typeof cancelBookingFormSchema>;
