import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const loginFormSchema = z.object({
  email: z.string().trim().min(1, "Vui lòng nhập email").email("Email không hợp lệ").max(255, "Email quá dài"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").max(128, "Mật khẩu quá dài")
});

export const registerFormSchema = z
  .object({
    fullName: z.string().trim().min(2, "Họ tên cần tối thiểu 2 ký tự").max(100, "Họ tên tối đa 100 ký tự"),
    email: z.string().trim().min(1, "Vui lòng nhập email").email("Email không hợp lệ").max(255, "Email quá dài"),
    phoneNumber: optionalTrimmedString.refine((value) => !value || /^[0-9+\-\s()]{7,20}$/.test(value), {
      message: "Số điện thoại không hợp lệ"
    }),
    password: z.string().min(8, "Mật khẩu cần tối thiểu 8 ký tự").max(128, "Mật khẩu quá dài"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
    priorityGroupCode: z.enum(["STAFF", "STUDENT", "EXTERNAL"], {
      message: "Vui lòng chọn nhóm người dùng"
    }),
    identityCode: optionalTrimmedString.refine((value) => !value || (value.length >= 2 && value.length <= 50), {
      message: "Mã định danh cần từ 2 đến 50 ký tự"
    })
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"]
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export type FormErrors<TValues extends Record<string, unknown>> = Partial<Record<keyof TValues, string>>;

export function toFormErrors<TValues extends Record<string, unknown>>(error: z.ZodError<TValues>): FormErrors<TValues> {
  const errors: FormErrors<TValues> = {};

  for (const issue of error.issues) {
    const field = issue.path[0] as keyof TValues | undefined;

    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}
