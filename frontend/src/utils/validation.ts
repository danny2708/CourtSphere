import { z } from "zod";

export const emailSchema = z.string().trim().email("Email không hợp lệ");

export const passwordSchema = z.string().min(8, "Mật khẩu cần tối thiểu 8 ký tự");

export const loginValidationSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Vui lòng nhập mật khẩu")
});

export const registerValidationSchema = z
  .object({
    fullName: z.string().trim().min(2, "Họ tên cần tối thiểu 2 ký tự").max(100, "Họ tên tối đa 100 ký tự"),
    email: emailSchema,
    phoneNumber: z.string().trim().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    priorityGroupCode: z.enum(["STAFF", "STUDENT", "EXTERNAL"]),
    identityCode: z.string().trim().optional()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"]
  });

export function getFirstValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Vui lòng kiểm tra lại thông tin đã nhập.";
}
