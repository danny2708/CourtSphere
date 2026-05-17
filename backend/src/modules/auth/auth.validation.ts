import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    phoneNumber: z.string().trim().min(7).max(20).optional(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    priorityGroupCode: z.enum(["STAFF", "STUDENT", "EXTERNAL"]),
    identityCode: z.string().trim().min(2).max(50).optional()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128)
});
