import { apiRequest } from "../../../api/client";
import type { AppNotification, ListNotificationsQuery } from "../types/notification.types";

function toQueryString(query: ListNotificationsQuery): string {
  const params = new URLSearchParams();

  if (query.isRead !== undefined) {
    params.set("isRead", String(query.isRead));
  }

  if (query.type) {
    params.set("type", query.type);
  }

  if (query.page) {
    params.set("page", String(query.page));
  }

  if (query.limit) {
    params.set("limit", String(query.limit));
  }

  return params.toString();
}

export async function listMyNotifications(query: ListNotificationsQuery = {}): Promise<AppNotification[]> {
  const queryString = toQueryString(query);
  const response = await apiRequest<{ notifications: AppNotification[] }>(
    `/api/notifications${queryString ? `?${queryString}` : ""}`,
    { auth: true, method: "GET" }
  );

  return response.notifications;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await apiRequest<{ count: number }>("/api/notifications/unread-count", {
    auth: true,
    method: "GET"
  });

  return response.count;
}

export async function markNotificationAsRead(notificationId: string): Promise<AppNotification> {
  const response = await apiRequest<{ notification: AppNotification }>(`/api/notifications/${notificationId}/read`, {
    auth: true,
    method: "PATCH"
  });

  return response.notification;
}

export async function markAllNotificationsAsRead(): Promise<number> {
  const response = await apiRequest<{ updatedCount: number }>("/api/notifications/read-all", {
    auth: true,
    method: "PATCH"
  });

  return response.updatedCount;
}
