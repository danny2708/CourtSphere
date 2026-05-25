import type { NotificationType } from "@prisma/client";

export type ListMyNotificationsQuery = {
  isRead?: boolean;
  type?: NotificationType;
  page: number;
  limit: number;
};

export type CreateNotificationInput = {
  userId: string;
  title: string;
  content: string;
  notificationType: NotificationType;
  bookingOrderId?: string | null;
  bookingItemId?: string | null;
  channel?: string;
  dedupe?: boolean;
};

