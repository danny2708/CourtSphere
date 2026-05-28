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
  managerHome: "/manager",
  adminHome: "/admin",
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
