export type BookingStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "PAYMENT_EXPIRED"
  | "CONFIRMED"
  | "PARTIALLY_CANCELLED"
  | "CANCELLED_BY_USER"
  | "CANCELLED_BY_MANAGER"
  | "CANCELLED_BY_ADMIN"
  | "IN_USE"
  | "COMPLETED"
  | "CHECKIN_EXPIRED"
  | "NO_SHOW";

export type PaymentStatus = "INITIATED" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";

export type RefundStatus = "REQUESTED" | "PROCESSING" | "SUCCESS" | "FAILED" | "MANUAL_REVIEW" | "REJECTED";

export type BookingCourtSummary = {
  id: string;
  courtName: string;
  status: string;
  courtType?: {
    id: string;
    typeName: string;
  };
};

export type BookingItem = {
  id: string;
  bookingItemId: string;
  court: BookingCourtSummary;
  startDatetime: string;
  endDatetime: string;
  unitPrice: number;
  amount: number;
  bookingStatus: BookingStatus;
  checkinTime?: string | null;
  managerNote?: string | null;
  statusHistories?: BookingStatusHistory[];
};

export type BookingStatusHistory = {
  id?: string;
  oldStatus: BookingStatus | null;
  newStatus: BookingStatus;
  actionType: string;
  note?: string | null;
  changedAt?: string;
  actionByUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

export type BookingPayment = {
  id: string;
  amount: number;
  paymentMethod: string;
  gatewayTransactionId: string;
  paymentStatus: PaymentStatus;
  paymentUrl?: string;
  paidAt?: string | null;
  createdAt?: string;
};

export type BookingRefund = {
  id: string;
  paymentId: string;
  bookingOrderId: string;
  bookingItemId?: string | null;
  refundAmount: number;
  refundReason?: string | null;
  refundStatus: RefundStatus;
  requestedAt?: string;
  processedAt?: string | null;
};

export type BookingOrder = {
  id: string;
  bookingOrderId: string;
  bookingCode: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  holdExpiresAt?: string | null;
  refundable?: boolean;
  note?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items: BookingItem[];
  statusHistories?: BookingStatusHistory[];
  payments?: BookingPayment[];
  refunds?: BookingRefund[];
};

export type CreateBookingPayload = {
  items: Array<{
    courtId: string;
    startDatetime: string;
    endDatetime: string;
  }>;
  note?: string;
};

export type CancelBookingPayload = {
  reason?: string;
};

export type ListMyBookingsQuery = {
  status?: BookingStatus;
  fromDate?: string;
  toDate?: string;
};
