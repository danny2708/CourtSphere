import {
  Prisma,
  PrismaClient,
  type CourtType,
  type OperatingHour,
  type PricingRule
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import type {
  CreateCourtInput,
  CreateCourtTypeInput,
  CreateOperatingHourInput,
  CreatePricingRuleInput,
  ListCourtsQuery,
  UpdateCourtInput,
  UpdateCourtStatusInput,
  UpdateCourtTypeInput,
  UpdateEntityStatusInput,
  UpdateOperatingHourInput,
  UpdatePricingRuleInput
} from "./courts.types";

const courtInclude = {
  courtType: true
} satisfies Prisma.CourtInclude;

const courtDetailInclude = {
  courtType: true,
  operatingHours: {
    orderBy: [{ weekday: "asc" as const }]
  },
  pricingRules: {
    include: {
      priorityGroup: true
    },
    orderBy: [{ startTime: "asc" as const }]
  }
} satisfies Prisma.CourtInclude;

type CourtWithType = Prisma.CourtGetPayload<{ include: typeof courtInclude }>;
type CourtDetail = Prisma.CourtGetPayload<{ include: typeof courtDetailInclude }>;
type PricingRuleWithPriorityGroup = Prisma.PricingRuleGetPayload<{
  include: { priorityGroup: true };
}>;

function toCourtTypeDto(courtType: CourtType) {
  return {
    id: courtType.courtTypeId,
    typeName: courtType.typeName,
    description: courtType.description,
    status: courtType.status,
    createdAt: courtType.createdAt,
    updatedAt: courtType.updatedAt
  };
}

function toCourtDto(court: CourtWithType | CourtDetail) {
  return {
    id: court.courtId,
    courtName: court.courtName,
    location: court.location,
    capacity: court.capacity,
    description: court.description,
    imageUrl: court.imageUrl,
    status: court.status,
    courtType: toCourtTypeDto(court.courtType),
    createdAt: court.createdAt,
    updatedAt: court.updatedAt
  };
}

function toCourtDetailDto(court: CourtDetail) {
  return {
    ...toCourtDto(court),
    operatingHours: court.operatingHours.map(toOperatingHourDto),
    pricingRules: court.pricingRules.map(toPricingRuleDto)
  };
}

function toOperatingHourDto(operatingHour: OperatingHour) {
  return {
    id: operatingHour.operatingHourId,
    courtId: operatingHour.courtId,
    weekday: operatingHour.weekday,
    openTime: operatingHour.openTime,
    closeTime: operatingHour.closeTime,
    slotDurationMinutes: operatingHour.slotDurationMinutes,
    status: operatingHour.status,
    createdAt: operatingHour.createdAt,
    updatedAt: operatingHour.updatedAt
  };
}

function toPricingRuleDto(pricingRule: PricingRule | PricingRuleWithPriorityGroup) {
  const priorityGroup =
    "priorityGroup" in pricingRule && pricingRule.priorityGroup
      ? {
          id: pricingRule.priorityGroup.priorityGroupId,
          code: pricingRule.priorityGroup.groupName,
          priorityLevel: pricingRule.priorityGroup.priorityLevel
        }
      : null;

  return {
    id: pricingRule.pricingRuleId,
    courtId: pricingRule.courtId,
    startTime: pricingRule.startTime,
    endTime: pricingRule.endTime,
    applicableDay: pricingRule.applicableDay,
    priceAmount: pricingRule.priceAmount.toString(),
    priorityGroup,
    effectiveFrom: pricingRule.effectiveFrom,
    effectiveTo: pricingRule.effectiveTo,
    status: pricingRule.status,
    createdAt: pricingRule.createdAt,
    updatedAt: pricingRule.updatedAt
  };
}

function handleKnownPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError(409, "Resource already exists", "UNIQUE_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2003") {
      throw new AppError(400, "Related resource does not exist", "FOREIGN_KEY_CONSTRAINT_VIOLATION");
    }
  }

  throw error;
}

export class CourtsService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listCourtTypes() {
    const courtTypes = await this.db.courtType.findMany({
      orderBy: [{ typeName: "asc" }]
    });

    return courtTypes.map(toCourtTypeDto);
  }

  async createCourtType(input: CreateCourtTypeInput) {
    try {
      const courtType = await this.db.courtType.create({
        data: input
      });

      return toCourtTypeDto(courtType);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async updateCourtType(id: string, input: UpdateCourtTypeInput) {
    try {
      const courtType = await this.db.courtType.update({
        where: { courtTypeId: id },
        data: input
      });

      return toCourtTypeDto(courtType);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError(404, "Court type not found", "COURT_TYPE_NOT_FOUND");
      }

      return handleKnownPrismaError(error);
    }
  }

  async updateCourtTypeStatus(id: string, input: UpdateEntityStatusInput) {
    try {
      const courtType = await this.db.courtType.update({
        where: { courtTypeId: id },
        data: { status: input.status }
      });

      return toCourtTypeDto(courtType);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError(404, "Court type not found", "COURT_TYPE_NOT_FOUND");
      }

      throw error;
    }
  }

  async listCourts(query: ListCourtsQuery) {
    const where: Prisma.CourtWhereInput = {
      ...(query.courtTypeId ? { courtTypeId: query.courtTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.location
        ? {
            location: {
              contains: query.location,
              mode: "insensitive"
            }
          }
        : {}),
      ...(query.keyword
        ? {
            OR: [
              {
                courtName: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              },
              {
                location: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              },
              {
                description: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    };

    const courts = await this.db.court.findMany({
      where,
      include: courtInclude,
      orderBy: [{ courtName: "asc" }]
    });

    return courts.map(toCourtDto);
  }

  async getCourtDetail(id: string) {
    const court = await this.db.court.findUnique({
      where: { courtId: id },
      include: courtDetailInclude
    });

    if (!court) {
      throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
    }

    return toCourtDetailDto(court);
  }

  async createCourt(input: CreateCourtInput) {
    try {
      const court = await this.db.court.create({
        data: input,
        include: courtInclude
      });

      return toCourtDto(court);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async updateCourt(id: string, input: UpdateCourtInput) {
    try {
      const court = await this.db.court.update({
        where: { courtId: id },
        data: input,
        include: courtInclude
      });

      return toCourtDto(court);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
      }

      return handleKnownPrismaError(error);
    }
  }

  async updateCourtStatus(id: string, actorUserId: string, input: UpdateCourtStatusInput) {
    return this.db.$transaction(async (tx) => {
      const currentCourt = await tx.court.findUnique({
        where: { courtId: id }
      });

      if (!currentCourt) {
        throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
      }

      const updatedCourt = await tx.court.update({
        where: { courtId: id },
        data: { status: input.status },
        include: courtInclude
      });

      if (currentCourt.status !== input.status) {
        await tx.courtStatusHistory.create({
          data: {
            courtId: id,
            updatedByUserId: actorUserId,
            oldStatus: currentCourt.status,
            newStatus: input.status,
            reason: input.reason
          }
        });
      }

      return toCourtDto(updatedCourt);
    });
  }

  async listOperatingHours(courtId: string) {
    await this.assertCourtExists(courtId);

    const operatingHours = await this.db.operatingHour.findMany({
      where: { courtId },
      orderBy: [{ weekday: "asc" }]
    });

    return operatingHours.map(toOperatingHourDto);
  }

  async createOperatingHour(courtId: string, input: CreateOperatingHourInput) {
    try {
      await this.assertCourtExists(courtId);

      const operatingHour = await this.db.operatingHour.create({
        data: {
          ...input,
          courtId
        }
      });

      return toOperatingHourDto(operatingHour);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async updateOperatingHour(id: string, input: UpdateOperatingHourInput) {
    try {
      const operatingHour = await this.db.operatingHour.update({
        where: { operatingHourId: id },
        data: input
      });

      return toOperatingHourDto(operatingHour);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError(404, "Operating hour not found", "OPERATING_HOUR_NOT_FOUND");
      }

      return handleKnownPrismaError(error);
    }
  }

  async updateOperatingHourStatus(id: string, input: UpdateEntityStatusInput) {
    try {
      const operatingHour = await this.db.operatingHour.update({
        where: { operatingHourId: id },
        data: { status: input.status }
      });

      return toOperatingHourDto(operatingHour);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError(404, "Operating hour not found", "OPERATING_HOUR_NOT_FOUND");
      }

      throw error;
    }
  }

  async listPricingRules(courtId: string) {
    await this.assertCourtExists(courtId);

    const pricingRules = await this.db.pricingRule.findMany({
      where: { courtId },
      include: { priorityGroup: true },
      orderBy: [{ startTime: "asc" }]
    });

    return pricingRules.map(toPricingRuleDto);
  }

  async createPricingRule(courtId: string, actorUserId: string, input: CreatePricingRuleInput) {
    try {
      await this.assertCourtExists(courtId);

      const pricingRule = await this.db.pricingRule.create({
        data: {
          ...input,
          courtId,
          createdByUserId: actorUserId
        },
        include: { priorityGroup: true }
      });

      return toPricingRuleDto(pricingRule);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async updatePricingRule(id: string, input: UpdatePricingRuleInput) {
    try {
      const pricingRule = await this.db.pricingRule.update({
        where: { pricingRuleId: id },
        data: input,
        include: { priorityGroup: true }
      });

      return toPricingRuleDto(pricingRule);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError(404, "Pricing rule not found", "PRICING_RULE_NOT_FOUND");
      }

      return handleKnownPrismaError(error);
    }
  }

  async updatePricingRuleStatus(id: string, input: UpdateEntityStatusInput) {
    try {
      const pricingRule = await this.db.pricingRule.update({
        where: { pricingRuleId: id },
        data: { status: input.status },
        include: { priorityGroup: true }
      });

      return toPricingRuleDto(pricingRule);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError(404, "Pricing rule not found", "PRICING_RULE_NOT_FOUND");
      }

      throw error;
    }
  }

  private async assertCourtExists(courtId: string): Promise<void> {
    const court = await this.db.court.findUnique({
      where: { courtId },
      select: { courtId: true }
    });

    if (!court) {
      throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
    }
  }
}

export const courtsService = new CourtsService();
