import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import type {
  CreateNotificationInput,
  ListMyNotificationsQuery
} from "./notifications.types";

const notificationSelect = {
  notificationId: true,
  userId: true,
  bookingOrderId: true,
  bookingItemId: true,
  title: true,
  content: true,
  notificationType: true,
  channel: true,
  isRead: true,
  createdAt: true
} satisfies Prisma.NotificationSelect;

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;
type NotificationDbClient = PrismaClient | Prisma.TransactionClient;

function toNotificationDto(notification: NotificationRecord) {
  return {
    id: notification.notificationId,
    notificationId: notification.notificationId,
    title: notification.title,
    content: notification.content,
    notificationType: notification.notificationType,
    channel: notification.channel,
    isRead: notification.isRead,
    bookingOrderId: notification.bookingOrderId,
    bookingItemId: notification.bookingItemId,
    createdAt: notification.createdAt
  };
}

export class NotificationsService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createNotification(
    db: NotificationDbClient,
    input: CreateNotificationInput
  ) {
    const dedupe = input.dedupe ?? true;
    const bookingOrderId = input.bookingOrderId ?? null;
    const bookingItemId = input.bookingItemId ?? null;

    if (dedupe) {
      const existing = await db.notification.findFirst({
        where: {
          userId: input.userId,
          notificationType: input.notificationType,
          bookingOrderId,
          bookingItemId,
          title: input.title,
          content: input.content
        },
        select: notificationSelect
      });

      if (existing) {
        return toNotificationDto(existing);
      }
    }

    const notification = await db.notification.create({
      data: {
        userId: input.userId,
        bookingOrderId,
        bookingItemId,
        title: input.title,
        content: input.content,
        notificationType: input.notificationType,
        channel: input.channel ?? "IN_APP"
      },
      select: notificationSelect
    });

    return toNotificationDto(notification);
  }

  async createBookingNotification(
    db: NotificationDbClient,
    input: CreateNotificationInput
  ) {
    return this.createNotification(db, input);
  }

  async createPaymentNotification(
    db: NotificationDbClient,
    input: CreateNotificationInput
  ) {
    return this.createNotification(db, input);
  }

  async createRefundNotification(
    db: NotificationDbClient,
    input: CreateNotificationInput
  ) {
    return this.createNotification(db, input);
  }

  async createWaitlistNotification(
    db: NotificationDbClient,
    input: CreateNotificationInput
  ) {
    return this.createNotification(db, input);
  }

  async createViolationNotification(
    db: NotificationDbClient,
    input: CreateNotificationInput
  ) {
    return this.createNotification(db, input);
  }

  async listMyNotifications(userId: string, query: ListMyNotificationsQuery) {
    const notifications = await this.db.notification.findMany({
      where: {
        userId,
        ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
        ...(query.type ? { notificationType: query.type } : {})
      },
      select: notificationSelect,
      orderBy: [{ createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit
    });

    return notifications.map(toNotificationDto);
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.db.notification.findFirst({
      where: {
        notificationId,
        userId
      },
      select: notificationSelect
    });

    if (!notification) {
      throw new AppError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");
    }

    if (notification.isRead) {
      return toNotificationDto(notification);
    }

    const updated = await this.db.notification.update({
      where: { notificationId },
      data: { isRead: true },
      select: notificationSelect
    });

    return toNotificationDto(updated);
  }

  async markAllAsRead(userId: string) {
    const result = await this.db.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    return {
      count: result.count
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.db.notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    return { count };
  }

}

export const notificationsService = new NotificationsService();
