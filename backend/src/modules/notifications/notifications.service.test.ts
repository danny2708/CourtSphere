import { NotificationType, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { NotificationsService } from "./notifications.service";

const userId = "00000000-0000-4000-8000-000000001801";
const otherUserId = "00000000-0000-4000-8000-000000001802";
const notificationId = "00000000-0000-4000-8000-000000001803";
const bookingOrderId = "00000000-0000-4000-8000-000000001804";
const bookingItemId = "00000000-0000-4000-8000-000000001805";
const now = new Date("2026-05-20T00:00:00.000Z");

function buildNotification(overrides: Record<string, unknown> = {}) {
  return {
    notificationId,
    userId,
    bookingOrderId,
    bookingItemId: null,
    title: "Payment successful",
    content: "Payment for booking succeeded.",
    notificationType: NotificationType.PAYMENT_SUCCESS,
    channel: "IN_APP",
    isRead: false,
    createdAt: now,
    ...overrides
  };
}

function createDb(overrides: Record<string, unknown> = {}) {
  return {
    notification: {
      findMany: vi.fn().mockResolvedValue([buildNotification()]),
      findFirst: vi.fn().mockResolvedValue(buildNotification()),
      create: vi.fn().mockResolvedValue(buildNotification()),
      update: vi.fn().mockResolvedValue(buildNotification({ isRead: true })),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      count: vi.fn().mockResolvedValue(3),
      ...overrides
    }
  } as unknown as PrismaClient;
}

describe("NotificationsService", () => {
  it("lists notifications for the current user with filters and pagination", async () => {
    const db = createDb();
    const service = new NotificationsService(db);

    const notifications = await service.listMyNotifications(userId, {
      isRead: false,
      type: NotificationType.PAYMENT_SUCCESS,
      page: 2,
      limit: 10
    });

    expect(notifications).toHaveLength(1);
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          isRead: false,
          notificationType: NotificationType.PAYMENT_SUCCESS
        },
        skip: 10,
        take: 10
      })
    );
  });

  it("marks an owned notification as read", async () => {
    const db = createDb();
    const service = new NotificationsService(db);

    const notification = await service.markAsRead(userId, notificationId);

    expect(notification.isRead).toBe(true);
    expect(db.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          notificationId,
          userId
        }
      })
    );
    expect(db.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { notificationId },
        data: { isRead: true }
      })
    );
  });

  it("does not allow marking another user's notification", async () => {
    const db = createDb({
      findFirst: vi.fn().mockResolvedValue(null)
    });
    const service = new NotificationsService(db);

    await expect(service.markAsRead(otherUserId, notificationId)).rejects.toMatchObject({
      statusCode: 404,
      code: "NOTIFICATION_NOT_FOUND"
    });
    expect(db.notification.update).not.toHaveBeenCalled();
  });

  it("marks all unread notifications as read", async () => {
    const db = createDb();
    const service = new NotificationsService(db);

    const result = await service.markAllAsRead(userId);

    expect(result).toEqual({ count: 2 });
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });
  });

  it("returns unread count", async () => {
    const db = createDb();
    const service = new NotificationsService(db);

    const result = await service.getUnreadCount(userId);

    expect(result).toEqual({ count: 3 });
    expect(db.notification.count).toHaveBeenCalledWith({
      where: {
        userId,
        isRead: false
      }
    });
  });

  it("deduplicates notification creation by user/type/order/item/title/content", async () => {
    const db = createDb({
      findFirst: vi.fn().mockResolvedValue(buildNotification({ bookingItemId })),
      create: vi.fn()
    });
    const service = new NotificationsService(db);

    const notification = await service.createBookingNotification(db, {
      userId,
      bookingOrderId,
      bookingItemId,
      notificationType: NotificationType.BOOKING_CREATED,
      title: "Booking hold created",
      content: "Booking is pending payment."
    });

    expect(notification.bookingItemId).toBe(bookingItemId);
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("creates waitlist and violation notifications through helper methods", async () => {
    const db = createDb({
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(
        buildNotification({
          notificationType: NotificationType.WAITLIST_EXPIRED,
          bookingOrderId: null,
          bookingItemId: null
        })
      )
    });
    const service = new NotificationsService(db);

    const waitlistNotification = await service.createWaitlistNotification(db, {
      userId,
      notificationType: NotificationType.WAITLIST_EXPIRED,
      title: "Waitlist response expired",
      content: "Your waitlist response window expired."
    });
    await service.createViolationNotification(db, {
      userId,
      bookingOrderId,
      bookingItemId,
      notificationType: NotificationType.VIOLATION_RECORDED,
      title: "Violation recorded",
      content: "A violation was recorded."
    });

    expect(waitlistNotification.notificationType).toBe(NotificationType.WAITLIST_EXPIRED);
    expect(db.notification.create).toHaveBeenCalledTimes(2);
  });
});

