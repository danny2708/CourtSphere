export type NotificationType =
  | "BOOKING_CREATED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_EXPIRED"
  | "BOOKING_CANCELLED"
  | "REFUND_REQUESTED"
  | "REFUND_SUCCESS"
  | "REFUND_FAILED"
  | "CHECKIN_EXPIRED"
  | "NO_SHOW"
  | "VIOLATION_RECORDED"
  | "BOOKING_PERMISSION_RESTRICTED"
  | "WAITLIST_NOTIFIED"
  | "WAITLIST_EXPIRED"
  | "SYSTEM";

export type AppNotification = {
  id: string;
  notificationId: string;
  title: string;
  content: string;
  notificationType: NotificationType;
  channel: string;
  isRead: boolean;
  bookingOrderId?: string | null;
  bookingItemId?: string | null;
  createdAt: string;
};

export type ListNotificationsQuery = {
  isRead?: boolean;
  type?: NotificationType;
  page?: number;
  limit?: number;
};
