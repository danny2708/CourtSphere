import type { AccountStatus, BookingPermissionStatus } from "@prisma/client";

import type { RoleName } from "../auth/services/rbac.service";

export type AdminListUsersQuery = {
  keyword?: string;
  accountStatus?: AccountStatus;
  bookingPermissionStatus?: BookingPermissionStatus;
  roleName?: RoleName;
  priorityGroupId?: string;
};

export type AdminUpdateUserProfileInput = {
  fullName?: string;
  email?: string;
  phoneNumber?: string | null;
  identityCode?: string | null;
};

export type AdminRoleInput = {
  roleName: RoleName;
};

export type AdminUpdateAccountStatusInput = {
  accountStatus: AccountStatus;
  reason?: string;
};

export type AdminUpdateBookingPermissionInput = {
  bookingPermissionStatus: BookingPermissionStatus;
  bookingLockedUntil?: Date | null;
  reason?: string;
};

export type AdminUpdatePriorityGroupInput = {
  priorityGroupId: string;
  reason?: string;
};

export type AuditContext = {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
};
