import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  Info,
  RefreshCw,
  ShieldAlert,
  TicketCheck,
  type LucideIcon
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/common/Button";
import { buildBookingDetailPath, buildBookingPaymentPath } from "../../../routes/route-paths";
import { useAuthStore } from "../../../stores/auth.store";
import { useToastStore, type ToastType } from "../../../stores/toast.store";
import { cn } from "../../../utils/cn";
import { getErrorMessage } from "../../../utils/format-error";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from "../services/notificationService";
import type { AppNotification, NotificationType } from "../types/notification.types";

type NotificationTone = "booking" | "danger" | "payment" | "success" | "system" | "violation" | "waitlist" | "warning";

type NotificationMeta = {
  Icon: LucideIcon;
  label: string;
  title: string;
  tone: NotificationTone;
};

const notificationMeta: Record<NotificationType, NotificationMeta> = {
  BOOKING_CREATED: {
    Icon: CalendarCheck,
    label: "Đặt sân",
    title: "Đã tạo giữ chỗ",
    tone: "booking"
  },
  PAYMENT_SUCCESS: {
    Icon: CreditCard,
    label: "Thanh toán",
    title: "Thanh toán thành công",
    tone: "success"
  },
  PAYMENT_EXPIRED: {
    Icon: Clock3,
    label: "Thanh toán",
    title: "Phiên thanh toán hết hạn",
    tone: "danger"
  },
  BOOKING_CANCELLED: {
    Icon: AlertTriangle,
    label: "Đặt sân",
    title: "Đơn đặt sân đã hủy",
    tone: "warning"
  },
  REFUND_REQUESTED: {
    Icon: CreditCard,
    label: "Hoàn tiền",
    title: "Đã ghi nhận yêu cầu hoàn tiền",
    tone: "payment"
  },
  REFUND_SUCCESS: {
    Icon: CheckCircle2,
    label: "Hoàn tiền",
    title: "Hoàn tiền thành công",
    tone: "success"
  },
  REFUND_FAILED: {
    Icon: AlertTriangle,
    label: "Hoàn tiền",
    title: "Hoàn tiền thất bại",
    tone: "danger"
  },
  CHECKIN_EXPIRED: {
    Icon: Clock3,
    label: "Check-in",
    title: "Quá hạn check-in",
    tone: "danger"
  },
  NO_SHOW: {
    Icon: ShieldAlert,
    label: "Đặt sân",
    title: "Ghi nhận vắng mặt",
    tone: "danger"
  },
  VIOLATION_RECORDED: {
    Icon: ShieldAlert,
    label: "Vi phạm",
    title: "Ghi nhận vi phạm",
    tone: "violation"
  },
  BOOKING_PERMISSION_RESTRICTED: {
    Icon: ShieldAlert,
    label: "Quyền đặt sân",
    title: "Quyền đặt sân bị hạn chế",
    tone: "danger"
  },
  WAITLIST_NOTIFIED: {
    Icon: TicketCheck,
    label: "Đến lượt hàng chờ",
    title: "Đến lượt hàng chờ",
    tone: "waitlist"
  },
  WAITLIST_EXPIRED: {
    Icon: Clock3,
    label: "Hàng chờ",
    title: "Hết hạn phản hồi hàng chờ",
    tone: "warning"
  },
  SYSTEM: {
    Icon: Info,
    label: "Hệ thống",
    title: "Thông báo hệ thống",
    tone: "system"
  }
};

const notificationTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit"
});

function extractBookingCode(content: string): string | null {
  return content.match(/\bBK-[0-9]{8}-[A-Z0-9]+\b/i)?.[0] ?? null;
}

function getNotificationContent(notification: AppNotification): string {
  const bookingCode = extractBookingCode(notification.content);

  switch (notification.notificationType) {
    case "BOOKING_CREATED":
      return bookingCode ? `Đơn ${bookingCode} đang chờ thanh toán.` : notification.content;
    case "PAYMENT_SUCCESS":
      return bookingCode ? `Thanh toán cho đơn ${bookingCode} đã thành công.` : notification.content;
    case "PAYMENT_EXPIRED":
      return bookingCode ? `Đơn ${bookingCode} đã hết hạn thanh toán.` : notification.content;
    case "BOOKING_CANCELLED":
      return bookingCode ? `Đơn ${bookingCode} đã được hủy.` : notification.content;
    case "WAITLIST_NOTIFIED":
      return notification.bookingOrderId
        ? "Đã tạo giữ chỗ cho khung giờ bạn đăng ký hàng chờ. Bấm thông báo để chuyển sang thanh toán."
        : "Khung giờ bạn đăng ký hàng chờ đã mở. Vui lòng xác nhận trong thời gian cho phép.";
    case "WAITLIST_EXPIRED":
      return "Thời gian phản hồi hàng chờ đã hết. Bạn có thể tham gia lại nếu vẫn cần khung giờ này.";
    case "CHECKIN_EXPIRED":
      return "Một lịch đặt sân đã quá hạn check-in. Vui lòng kiểm tra chi tiết đơn.";
    case "NO_SHOW":
      return "Hệ thống đã ghi nhận vắng mặt cho một lịch đặt sân.";
    case "BOOKING_PERMISSION_RESTRICTED":
      return "Tài khoản đang bị hạn chế quyền đặt sân. Vui lòng kiểm tra vi phạm hoặc liên hệ quản trị.";
    default:
      return notification.content;
  }
}

function countText(count: number): string {
  return count > 99 ? "99+" : String(count);
}

function getNotificationToastType(notification: AppNotification): ToastType {
  switch (notification.notificationType) {
    case "PAYMENT_SUCCESS":
    case "REFUND_SUCCESS":
      return "success";
    case "PAYMENT_EXPIRED":
    case "REFUND_FAILED":
    case "CHECKIN_EXPIRED":
    case "NO_SHOW":
    case "VIOLATION_RECORDED":
    case "BOOKING_PERMISSION_RESTRICTED":
      return "error";
    case "BOOKING_CANCELLED":
    case "WAITLIST_NOTIFIED":
    case "WAITLIST_EXPIRED":
      return "warning";
    default:
      return "info";
  }
}

function getNotificationPath(notification: AppNotification): string | null {
  if (!notification.bookingOrderId) {
    return null;
  }

  if (notification.notificationType === "WAITLIST_NOTIFIED") {
    return buildBookingPaymentPath(notification.bookingOrderId);
  }

  return buildBookingDetailPath(notification.bookingOrderId);
}

export function NotificationBell() {
  const { isAuthenticated } = useAuthStore();
  const { addToast } = useToastStore();
  const hasSyncedNotificationsRef = useRef(false);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setError(null);
      setHasLoaded(false);
      setNotifications([]);
      setUnreadCount(0);
      hasSyncedNotificationsRef.current = false;
      knownNotificationIdsRef.current = new Set();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [loadedNotifications, loadedUnreadCount] = await Promise.all([
        listMyNotifications({ limit: 20 }),
        getUnreadNotificationCount()
      ]);
      const newNotifications = loadedNotifications.filter(
        (notification) => !knownNotificationIdsRef.current.has(notification.notificationId)
      );

      if (hasSyncedNotificationsRef.current) {
        [...newNotifications].reverse().forEach((notification) => {
          const meta = notificationMeta[notification.notificationType];

          addToast({
            type: getNotificationToastType(notification),
            title: meta.title,
            message: getNotificationContent(notification),
            durationMs: 6200
          });
        });
      }

      loadedNotifications.forEach((notification) => {
        knownNotificationIdsRef.current.add(notification.notificationId);
      });
      hasSyncedNotificationsRef.current = true;
      setNotifications(loadedNotifications);
      setUnreadCount(loadedUnreadCount);
      setHasLoaded(true);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [addToast, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsOpen(false);
      setNotifications([]);
      setUnreadCount(0);
      setHasLoaded(false);
      hasSyncedNotificationsRef.current = false;
      knownNotificationIdsRef.current = new Set();
      return;
    }

    void loadNotifications();
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, loadNotifications]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isAuthenticated) {
    return null;
  }

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      void loadNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    setIsMarkingRead(true);
    setError(null);

    try {
      await markAllNotificationsAsRead();
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({ ...notification, isRead: true }))
      );
      setUnreadCount(0);
    } catch (markError) {
      setError(getErrorMessage(markError));
    } finally {
      setIsMarkingRead(false);
    }
  };

  const handleMarkOneAsRead = async (notification: AppNotification) => {
    if (notification.isRead) {
      return;
    }

    setNotifications((currentNotifications) =>
      currentNotifications.map((currentNotification) =>
        currentNotification.notificationId === notification.notificationId
          ? { ...currentNotification, isRead: true }
          : currentNotification
      )
    );
    setUnreadCount((currentCount) => Math.max(0, currentCount - 1));

    try {
      await markNotificationAsRead(notification.notificationId);
    } catch {
      void loadNotifications();
    }
  };

  return (
    <div className="notification-bell" ref={rootRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
        className="header-icon-button notification-bell__button"
        size="sm"
        variant="icon"
        onClick={handleToggle}
      >
        <Bell aria-hidden="true" size={18} />
        {unreadCount > 0 ? <span className="notification-bell__badge">{countText(unreadCount)}</span> : null}
      </Button>

      {isOpen ? (
        <div className="notification-panel" role="dialog" aria-label="Thông báo hệ thống">
          <div className="notification-panel__header">
            <div>
              <p className="eyebrow">Thông báo</p>
              <h2>Trung tâm thông báo</h2>
            </div>
            <div className="notification-panel__actions">
              <Button
                aria-label="Tải lại thông báo"
                className={cn("notification-panel__icon-button", isLoading && "notification-panel__icon-button--loading")}
                disabled={isLoading}
                size="sm"
                variant="icon"
                onClick={() => void loadNotifications()}
              >
                <RefreshCw aria-hidden="true" size={16} />
              </Button>
              <button
                className="notification-panel__text-button"
                disabled={unreadCount === 0 || isMarkingRead}
                type="button"
                onClick={handleMarkAllAsRead}
              >
                Đã đọc tất cả
              </button>
            </div>
          </div>

          {error ? (
            <div className="notification-panel__state notification-panel__state--error" role="alert">
              <AlertTriangle aria-hidden="true" size={18} />
              <span>{error}</span>
            </div>
          ) : null}

          {!error && isLoading && !hasLoaded ? (
            <div className="notification-panel__state">
              <RefreshCw aria-hidden="true" size={18} />
              <span>Đang tải thông báo...</span>
            </div>
          ) : null}

          {!error && hasLoaded && notifications.length === 0 ? (
            <div className="notification-panel__empty">
              <Bell aria-hidden="true" size={24} />
              <strong>Chưa có thông báo</strong>
              <span>Các cập nhật về đặt sân, thanh toán và hàng chờ sẽ xuất hiện tại đây.</span>
            </div>
          ) : null}

          {!error && notifications.length > 0 ? (
            <ul className="notification-list" role="list">
              {notifications.map((notification) => {
                const meta = notificationMeta[notification.notificationType];
                const Icon = meta.Icon;
                const notificationPath = getNotificationPath(notification);

                return (
                  <li
                    className={cn(
                      "notification-item",
                      `notification-item--${meta.tone}`,
                      !notification.isRead && "notification-item--unread"
                    )}
                    key={notification.notificationId}
                  >
                    <span className={cn("notification-item__icon", `notification-item__icon--${meta.tone}`)}>
                      <Icon aria-hidden="true" size={18} />
                    </span>
                    <div className="notification-item__body">
                      <div className="notification-item__meta">
                        <span>{meta.label}</span>
                        <time dateTime={notification.createdAt}>
                          {notificationTimeFormatter.format(new Date(notification.createdAt))}
                        </time>
                      </div>
                      {notificationPath ? (
                        <Link
                          className="notification-item__title"
                          to={notificationPath}
                          onClick={() => {
                            setIsOpen(false);
                            void handleMarkOneAsRead(notification);
                          }}
                        >
                          {meta.title}
                        </Link>
                      ) : (
                        <button
                          className="notification-item__title notification-item__title--button"
                          type="button"
                          onClick={() => void handleMarkOneAsRead(notification)}
                        >
                          {meta.title}
                        </button>
                      )}
                      <p>{getNotificationContent(notification)}</p>
                    </div>
                    {!notification.isRead ? <span className="notification-item__dot" aria-label="Chưa đọc" /> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
