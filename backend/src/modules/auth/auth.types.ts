import type { AccountStatus, BookingPermissionStatus } from "@prisma/client";

export type PriorityGroupCode = "STAFF" | "STUDENT" | "EXTERNAL";

export type AuthUserDto = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  identityCode: string | null;
  accountStatus: AccountStatus;
  bookingPermissionStatus: BookingPermissionStatus;
  roles: string[];
  priorityGroup: {
    id: string;
    code: string;
    name: string;
    priorityLevel: number;
    advanceBookingDays: number;
  } | null;
};

export type AuthResponse = {
  accessToken: string;
  tokenType: "Bearer";
  user: AuthUserDto;
};

export type RegisterInput = {
  fullName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  confirmPassword: string;
  priorityGroupCode: PriorityGroupCode;
  identityCode?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};
