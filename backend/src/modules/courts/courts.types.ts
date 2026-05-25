import type { CourtStatus, EntityStatus } from "@prisma/client";

export type ListCourtsQuery = {
  keyword?: string;
  courtTypeId?: string;
  status?: CourtStatus;
};

export type CreateCourtTypeInput = {
  typeName: string;
  description?: string;
};

export type UpdateCourtTypeInput = Partial<CreateCourtTypeInput>;

export type UpdateEntityStatusInput = {
  status: EntityStatus;
};

export type CreateCourtInput = {
  courtTypeId: string;
  courtName: string;
  description?: string;
  imageUrl?: string;
};

export type UpdateCourtInput = Partial<CreateCourtInput>;

export type UpdateCourtStatusInput = {
  status: CourtStatus;
  reason?: string;
};

export type CreateOperatingHourInput = {
  weekday: number;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
};

export type UpdateOperatingHourInput = Partial<CreateOperatingHourInput>;

export type CreatePricingRuleInput = {
  startTime: string;
  endTime: string;
  applicableDay?: number;
  priceAmount: string;
  priorityGroupId?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
};

export type UpdatePricingRuleInput = Partial<CreatePricingRuleInput>;
