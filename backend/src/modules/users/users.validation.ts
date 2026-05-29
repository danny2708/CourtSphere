import { AccountStatus, BookingPermissionStatus } from "@prisma/client";
import { z } from "zod";

export const userIdParamSchema = z.object({
  id: z.string().uuid()
});

export const userRoleParamSchema = z.object({
  id: z.string().uuid(),
  roleName: z.enum(["USER", "FIELD_MANAGER", "ADMIN"])
});

export const listUsersQuerySchema = z.object({
  keyword: z.string().trim().min(1).max(100).optional(),
  accountStatus: z.enum(AccountStatus).optional(),
  bookingPermissionStatus: z.enum(BookingPermissionStatus).optional(),
  roleName: z.enum(["USER", "FIELD_MANAGER", "ADMIN"]).optional(),
  priorityGroupId: z.string().uuid().optional()
});

export const updateUserProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()).optional(),
    phoneNumber: z.string().trim().min(7).max(20).nullable().optional(),
    identityCode: z.string().trim().min(2).max(50).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const roleBodySchema = z.object({
  roleName: z.enum(["USER", "FIELD_MANAGER", "ADMIN"])
});

export const updateAccountStatusSchema = z.object({
  accountStatus: z.enum(AccountStatus),
  reason: z.string().trim().min(1).max(500).optional()
});

export const updateBookingPermissionSchema = z.object({
  bookingPermissionStatus: z.enum(BookingPermissionStatus),
  bookingLockedUntil: z.coerce.date().nullable().optional(),
  reason: z.string().trim().min(1).max(500).optional()
});

export const updatePriorityGroupSchema = z.object({
  priorityGroupId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500).optional()
});
