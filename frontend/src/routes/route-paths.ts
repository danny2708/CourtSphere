export const ROUTE_PATHS = {
  home: "/",
  login: "/login",
  register: "/register",
  userHome: "/user",
  courts: "/courts",
  courtDetail: "/courts/:courtId",
  bookingCreate: "/bookings/create",
  myBookings: "/bookings/my",
  bookingDetail: "/bookings/:bookingOrderId",
  bookingPayment: "/bookings/:bookingOrderId/payment",
  momoPaymentReturn: "/payments/momo-return",
  managerHome: "/manager",
  managerToday: "/manager/today",
  managerCheckIn: "/manager/check-in",
  managerInUse: "/manager/in-use",
  managerNoShow: "/manager/no-show",
  managerCourts: "/manager/courts",
  managerOperatingHours: "/manager/operating-hours",
  managerHistory: "/manager/history",
  adminHome: "/admin",
  adminDashboard: "/admin/dashboard",
  adminUsers: "/admin/users",
  adminRoles: "/admin/roles",
  adminPriorityGroups: "/admin/priority-groups",
  adminCourtTypes: "/admin/court-types",
  adminCourts: "/admin/courts",
  adminOperatingHours: "/admin/operating-hours",
  adminPricingRules: "/admin/pricing-rules",
  adminBookingRules: "/admin/booking-rules",
  adminPriorityPolicies: "/admin/priority-policies",
  adminPayments: "/admin/payments",
  adminRefunds: "/admin/refunds",
  adminViolations: "/admin/violations",
  adminReports: "/admin/reports",
  map: "/map",
  featured: "/featured",
  account: "/account",
  forbidden: "/403"
} as const;

export const PUBLIC_ROUTE_PATHS = [ROUTE_PATHS.login, ROUTE_PATHS.register, ROUTE_PATHS.forbidden] as const;

export function buildCourtDetailPath(courtId: string): string {
  return `/courts/${courtId}`;
}

export function buildBookingDetailPath(bookingOrderId: string): string {
  return `/bookings/${bookingOrderId}`;
}

export function buildBookingPaymentPath(bookingOrderId: string): string {
  return `/bookings/${bookingOrderId}/payment`;
}

export function buildBookingCreatePath(input: {
  courtId: string;
  date: string;
  startDatetime: string;
  endDatetime: string;
}): string {
  const params = new URLSearchParams({
    courtId: input.courtId,
    date: input.date,
    start: input.startDatetime,
    end: input.endDatetime
  });

  return `${ROUTE_PATHS.bookingCreate}?${params.toString()}`;
}

export function buildBookingCreateSelectionPath(input: {
  courtId: string;
  selectionId: string;
}): string {
  const params = new URLSearchParams({
    courtId: input.courtId,
    selectionId: input.selectionId
  });

  return `${ROUTE_PATHS.bookingCreate}?${params.toString()}`;
}
