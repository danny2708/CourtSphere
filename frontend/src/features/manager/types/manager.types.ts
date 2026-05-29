export type ManagerBookingItemStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "PAYMENT_EXPIRED"
  | "CONFIRMED"
  | "IN_USE"
  | "COMPLETED"
  | "CANCELLED_BY_USER"
  | "CANCELLED_BY_MANAGER"
  | "CANCELLED_BY_ADMIN"
  | "CHECKIN_EXPIRED"
  | "NO_SHOW";

export type ManagerPaymentStatus = "INITIATED" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";

export type ManagerCourtStatus = "ACTIVE" | "MAINTENANCE" | "TEMP_CLOSED" | "RETIRED";

export type ManagerBookingItemViewModel = {
  bookingOrderId: string;
  bookingItemId: string;
  bookingCode?: string;
  userName?: string;
  userEmail?: string;
  courtId: string;
  courtName?: string;
  courtTypeName?: string;
  courtStatus?: ManagerCourtStatus;
  startDatetime: string;
  endDatetime: string;
  startTimeText: string;
  endTimeText: string;
  dateText: string;
  status: ManagerBookingItemStatus;
  paymentStatus?: ManagerPaymentStatus;
  unitPrice?: number;
  amount?: number;
  amountText?: string;
  checkinTime?: string | null;
  managerNote?: string | null;
};

export type ManagerCourtViewModel = {
  id: string;
  name: string;
  status: ManagerCourtStatus;
  courtTypeName?: string;
  description?: string | null;
  imageUrl?: string | null;
};

export type ManagerScheduleFilterState = {
  keyword: string;
  courtId: string;
  status: "ALL" | ManagerBookingItemStatus;
  timeRange: "ALL" | "MORNING" | "AFTERNOON" | "EVENING";
};

export type ManagerActionPayload = {
  reason?: string;
};

export type ManagerCancelBookingResponse = {
  bookingOrder?: {
    id?: string;
    bookingOrderId?: string;
    bookingCode?: string;
    bookingStatus?: string;
    paymentStatus?: string;
    cancelReason?: string | null;
    refundable?: boolean;
  };
  refund?: {
    id?: string;
    refundAmount?: number;
    refundStatus?: string;
  } | null;
};
