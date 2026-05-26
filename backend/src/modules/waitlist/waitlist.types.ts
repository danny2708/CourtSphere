import type { WaitlistStatus } from "@prisma/client";

export type JoinWaitlistInput = {
  courtId: string;
  startDatetime: Date;
  endDatetime: Date;
};

export type ListMyWaitlistQuery = {
  status?: WaitlistStatus;
  fromDate?: Date;
  toDate?: Date;
};

export type NotifyNextForSlotInput = {
  courtId: string;
  startDatetime: Date;
  endDatetime: Date;
};

export type BookFromWaitlistInput = {
  waitlistEntryId: string;
};
