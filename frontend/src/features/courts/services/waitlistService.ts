import { apiRequest } from "../../../api/client";

export type JoinWaitlistPayload = {
  courtId: string;
  startDatetime: string;
  endDatetime: string;
};

export type WaitlistEntry = {
  id: string;
  waitlistEntryId: string;
  desiredStartDatetime: string;
  desiredEndDatetime: string;
  status: string;
};

export async function joinWaitlist(payload: JoinWaitlistPayload): Promise<WaitlistEntry> {
  const response = await apiRequest<{ waitlistEntry: WaitlistEntry }>("/api/waitlist", {
    auth: true,
    body: payload,
    method: "POST"
  });

  return response.waitlistEntry;
}
