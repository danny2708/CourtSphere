export type AdminRoleName = "USER" | "FIELD_MANAGER" | "ADMIN";
export type AccountStatus = "ACTIVE" | "LOCKED" | "DISABLED";
export type BookingPermissionStatus = "ALLOWED" | "RESTRICTED";
export type EntityStatus = "ACTIVE" | "INACTIVE";
export type CourtStatus = "ACTIVE" | "MAINTENANCE" | "TEMP_CLOSED" | "RETIRED";
export type PaymentStatus = "INITIATED" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
export type RefundStatus = "REQUESTED" | "PROCESSING" | "SUCCESS" | "FAILED" | "MANUAL_REVIEW" | "REJECTED";

export type AdminPriorityGroup = {
  id: string;
  groupCode: string;
  groupName: string;
  priorityLevel: number;
  advanceBookingDays: number;
  description?: string | null;
  status?: EntityStatus;
  userCount?: number;
};

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  identityCode?: string | null;
  accountStatus: AccountStatus;
  bookingPermissionStatus: BookingPermissionStatus;
  bookingLockedUntil?: string | null;
  violationPoints?: number;
  reputationPoints?: number;
  roles: AdminRoleName[];
  priorityGroup?: {
    id: string;
    code?: string;
    groupCode?: string;
    name?: string;
    groupName?: string;
    priorityLevel?: number;
    advanceBookingDays?: number;
  } | null;
};

export type AdminCourtType = {
  id: string;
  typeName: string;
  description?: string | null;
  status: EntityStatus;
};

export type AdminCourt = {
  id: string;
  courtName: string;
  description?: string | null;
  imageUrl?: string | null;
  status: CourtStatus;
  courtType?: AdminCourtType | null;
};

export type AdminOperatingHour = {
  id: string;
  weekday: number;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
  status: EntityStatus;
};

export type AdminPricingRule = {
  id: string;
  startTime: string;
  endTime: string;
  applicableDay?: number | null;
  priceAmount: number;
  priorityGroupId?: string | null;
  priorityGroup?: AdminPriorityGroup | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  status: EntityStatus;
};

export type AdminBookingRules = {
  id?: string;
  maxBookingsPerDay: number;
  maxDurationMinutes: number;
  holdMinutes: number;
  cancelBeforeHours: number;
  lateCheckinMinutes: number;
  violationThreshold: number;
  bookingBanDays: number;
  refundRateUserOnTime: number;
  refundRateManagerFault: number;
  status?: EntityStatus;
};

export type AdminPriorityPolicy = {
  id: string;
  priorityGroupId: string;
  priorityGroup?: Pick<AdminPriorityGroup, "id" | "groupCode" | "groupName"> | null;
  policyName?: string;
  priorityRank: number;
  advanceBookingDays: number;
  maxBookingsPerDay?: number;
  maxDurationMinutes?: number;
  canJoinWaitlist?: boolean;
  canBookPrioritySlots?: boolean;
  status?: EntityStatus;
};

export type AdminPayment = {
  id: string;
  amount: number;
  paymentMethod?: string;
  paymentStatus: PaymentStatus;
  paidAt?: string | null;
  bookingOrder?: {
    id?: string;
    bookingOrderId?: string;
    bookingCode?: string;
    bookingStatus?: string;
    paymentStatus?: PaymentStatus;
  } | null;
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
  } | null;
};

export type AdminRefund = {
  id: string;
  paymentId?: string;
  bookingOrderId?: string;
  bookingItemId?: string | null;
  refundAmount: number;
  refundReason?: string | null;
  refundStatus: RefundStatus;
  requestedAt?: string | null;
  processedAt?: string | null;
  bookingOrder?: {
    bookingCode?: string;
    bookingStatus?: string;
    paymentStatus?: PaymentStatus;
  } | null;
};

export type AdminViolation = {
  id: string;
  violationId?: string;
  violationType: string;
  penaltyPoints: number;
  description?: string | null;
  isWaived: boolean;
  recordedAt?: string;
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
    bookingPermissionStatus?: BookingPermissionStatus;
    violationPoints?: number;
  } | null;
  bookingItem?: {
    id?: string;
    bookingStatus?: string;
    court?: {
      courtName?: string;
    } | null;
    bookingOrder?: {
      bookingCode?: string;
    } | null;
  } | null;
};

export type AdminOverviewReport = {
  totalBookingOrders?: number;
  totalBookingItems?: number;
  grossRevenue?: number;
  totalRevenue?: number;
  totalRefundAmount?: number;
  netRevenue?: number;
  totalCancelled?: number;
  totalNoShow?: number;
  totalUsers?: number;
  activeCourts?: number;
  waitlistCount?: number;
  violationCount?: number;
};

export type AdminReportBundle = {
  overview?: AdminOverviewReport;
  bookings?: unknown;
  revenue?: unknown;
  courtUsage?: unknown;
  rates?: unknown;
  violations?: unknown;
};

export type AdminConfirmDialogState =
  | {
      type: "confirm";
      title: string;
      message: string;
      confirmLabel?: string;
      tone?: "danger" | "primary";
      reasonRequired?: boolean;
      onConfirm: (reason: string) => Promise<void>;
    }
  | {
      type: "role";
      user: AdminUser;
      mode: "assign" | "remove";
      onConfirm: (roleName: AdminRoleName) => Promise<void>;
    }
  | {
      type: "userStatus";
      user: AdminUser;
      onConfirm: (status: AccountStatus, reason: string) => Promise<void>;
    }
  | {
      type: "bookingPermission";
      user: AdminUser;
      onConfirm: (status: BookingPermissionStatus, reason: string) => Promise<void>;
    }
  | {
      type: "priority";
      user: AdminUser;
      priorityGroups: AdminPriorityGroup[];
      onConfirm: (priorityGroupId: string, reason: string) => Promise<void>;
    };
