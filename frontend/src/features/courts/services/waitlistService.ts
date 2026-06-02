import { apiRequest } from "../../../api/client";

export type JoinWaitlistPayload = {
  courtId: string;
  startDatetime: string;
  endDatetime: string;
};

export type WaitlistStatus = "WAITING" | "NOTIFIED" | "BOOKED" | "CANCELLED" | "EXPIRED";

export type WaitlistEntry = {
  id: string;
  waitlistEntryId: string;
  userId: string;
  court: {
    id: string;
    courtId: string;
    courtName: string;
    status: string;
    courtType: {
      id: string;
      courtTypeId: string;
      typeName: string;
    };
  };
  priorityGroup: {
    id: string;
    priorityGroupId: string;
    groupCode: string;
    groupName: string;
    priorityLevel: number;
  } | null;
  desiredStartDatetime: string;
  desiredEndDatetime: string;
  priorityOrder: number;
  status: WaitlistStatus;
  registeredAt: string;
  notifiedAt?: string | null;
  expiresAt?: string | null;
};

export type ListMyWaitlistQuery = {
  status?: WaitlistStatus;
  fromDate?: string;
  toDate?: string;
};

function buildWaitlistQuery(query: ListMyWaitlistQuery = {}): string {
  const params = new URLSearchParams();

  if (query.status) {
    params.set("status", query.status);
  }

  if (query.fromDate) {
    params.set("fromDate", query.fromDate);
  }

  if (query.toDate) {
    params.set("toDate", query.toDate);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function joinWaitlist(payload: JoinWaitlistPayload): Promise<WaitlistEntry> {
  const response = await apiRequest<{ waitlistEntry: WaitlistEntry }>("/api/waitlist", {
    auth: true,
    body: payload,
    method: "POST"
  });

  return response.waitlistEntry;
}

export async function listMyWaitlist(query?: ListMyWaitlistQuery): Promise<WaitlistEntry[]> {
  const response = await apiRequest<{ waitlistEntries: WaitlistEntry[] }>(`/api/waitlist/my${buildWaitlistQuery(query)}`, {
    auth: true
  });

  return response.waitlistEntries;
}

export async function cancelWaitlist(waitlistEntryId: string): Promise<WaitlistEntry> {
  const response = await apiRequest<{ waitlistEntry: WaitlistEntry }>(`/api/waitlist/${waitlistEntryId}`, {
    auth: true,
    method: "DELETE"
  });

  return response.waitlistEntry;
}
