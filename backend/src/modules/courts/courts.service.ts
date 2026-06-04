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
  ActorContext,
  CreateCourtInput,
  CreateCourtTypeInput,
  CreateOperatingHourInput,
  CreatePricingRuleInput,
  ListCourtsQuery,
  UpdateCourtInput,
  UpdateCourtManagersInput,
  UpdateCourtStatusInput,
  UpdateCourtTypeInput,
  UpdateEntityStatusInput,
  UpdateOperatingHourInput,
  UpdatePricingRuleInput
} from "./courts.types";

const courtInclude = {
  courtType: true,
  managerAssignments: {
    include: {
      user: {
        select: {
          userId: true,
          fullName: true,
          email: true,
          accountStatus: true
        }
      }
    },
    orderBy: { assignedAt: "asc" as const }
  },
  operatingHours: {
    orderBy: [{ weekday: "asc" as const }]
  },
  pricingRules: {
    include: {
      priorityGroup: true
    },
    orderBy: [{ priorityOrder: "asc" as const }, { applicableDay: "asc" as const }, { startTime: "asc" as const }]
  }
} satisfies Prisma.CourtInclude;

const courtDetailInclude = {
  courtType: true,
  managerAssignments: {
    include: {
      user: {
        select: {
          userId: true,
          fullName: true,
          email: true,
          accountStatus: true
        }
      }
    },
    orderBy: { assignedAt: "asc" as const }
  },
  operatingHours: {
    orderBy: [{ weekday: "asc" as const }]
  },
  pricingRules: {
    include: {
      priorityGroup: true
    },
    orderBy: [{ priorityOrder: "asc" as const }, { applicableDay: "asc" as const }, { startTime: "asc" as const }]
  }
} satisfies Prisma.CourtInclude;

type CourtWithType = Prisma.CourtGetPayload<{ include: typeof courtInclude }>;
type CourtDetail = Prisma.CourtGetPayload<{ include: typeof courtDetailInclude }>;
type PricingRuleWithPriorityGroup = Prisma.PricingRuleGetPayload<{
  include: { priorityGroup: true };
}>;
type CourtDbClient = PrismaClient | Prisma.TransactionClient;

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
    description: court.description,
    imageUrl: court.imageUrl,
    status: court.status,
    courtType: toCourtTypeDto(court.courtType),
    assignedManagers: court.managerAssignments.map((assignment) => ({
      id: assignment.user.userId,
      fullName: assignment.user.fullName,
      email: assignment.user.email,
      accountStatus: assignment.user.accountStatus,
      assignedAt: assignment.assignedAt
    })),
    operatingHours: court.operatingHours.map(toOperatingHourDto),
    pricingRules: court.pricingRules.map(toPricingRuleDto),
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
          code: pricingRule.priorityGroup.groupCode,
          name: pricingRule.priorityGroup.groupName,
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
    priorityOrder: pricingRule.priorityOrder,
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

  async listCourts(query: ListCourtsQuery, actor?: ActorContext) {
    const where: Prisma.CourtWhereInput = {
      ...(query.courtTypeId ? { courtTypeId: query.courtTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.managedOnly && this.isFieldManagerOnly(actor)
        ? { managerAssignments: { some: { userId: actor.actorUserId } } }
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

  async updateCourt(id: string, input: UpdateCourtInput, actor?: ActorContext) {
    try {
      await this.assertCanManageCourt(id, actor);

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

  async updateCourtStatus(id: string, actor: ActorContext, input: UpdateCourtStatusInput) {
    return this.db.$transaction(async (tx) => {
      const currentCourt = await tx.court.findUnique({
        where: { courtId: id }
      });

      if (!currentCourt) {
        throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
      }

      await this.assertCanManageCourt(id, actor, tx);

      const updatedCourt = await tx.court.update({
        where: { courtId: id },
        data: { status: input.status },
        include: courtInclude
      });

      if (currentCourt.status !== input.status) {
        await tx.courtStatusHistory.create({
          data: {
            courtId: id,
            updatedByUserId: actor.actorUserId,
            oldStatus: currentCourt.status,
            newStatus: input.status,
            reason: input.reason
          }
        });
      }

      return toCourtDto(updatedCourt);
    });
  }

  async updateCourtManagers(courtId: string, actorUserId: string, input: UpdateCourtManagersInput) {
    const managerUserIds = [...new Set(input.managerUserIds)];

    return this.db.$transaction(async (tx) => {
      const court = await tx.court.findUnique({
        where: { courtId },
        select: { courtId: true }
      });

      if (!court) {
        throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
      }

      if (managerUserIds.length > 0) {
        const managers = await tx.user.findMany({
          where: {
            userId: { in: managerUserIds },
            userRoles: {
              some: {
                role: { roleName: "FIELD_MANAGER" }
              }
            }
          },
          select: { userId: true }
        });
        const validManagerIds = new Set(managers.map((manager) => manager.userId));
        const invalidManagerIds = managerUserIds.filter((managerUserId) => !validManagerIds.has(managerUserId));

        if (invalidManagerIds.length > 0) {
          throw new AppError(
            400,
            "All assigned users must have FIELD_MANAGER role",
            "INVALID_COURT_MANAGER_ASSIGNMENT"
          );
        }
      }

      await tx.courtManagerAssignment.deleteMany({ where: { courtId } });

      if (managerUserIds.length > 0) {
        await tx.courtManagerAssignment.createMany({
          data: managerUserIds.map((managerUserId) => ({
            courtId,
            userId: managerUserId,
            assignedByUserId: actorUserId
          })),
          skipDuplicates: true
        });
      }

      const updatedCourt = await tx.court.findUniqueOrThrow({
        where: { courtId },
        include: courtInclude
      });

      return toCourtDto(updatedCourt);
    });
  }

  async listOperatingHours(courtId: string, actor?: ActorContext) {
    await this.assertCourtExists(courtId);
    await this.assertCanManageCourt(courtId, actor);

    const operatingHours = await this.db.operatingHour.findMany({
      where: { courtId },
      orderBy: [{ weekday: "asc" }]
    });

    return operatingHours.map(toOperatingHourDto);
  }

  async createOperatingHour(courtId: string, input: CreateOperatingHourInput, actor?: ActorContext) {
    try {
      await this.assertCourtExists(courtId);
      await this.assertCanManageCourt(courtId, actor);

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

  async updateOperatingHour(id: string, input: UpdateOperatingHourInput, actor?: ActorContext) {
    try {
      await this.assertCanManageOperatingHour(id, actor);

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

  async updateOperatingHourStatus(id: string, input: UpdateEntityStatusInput, actor?: ActorContext) {
    try {
      await this.assertCanManageOperatingHour(id, actor);

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

  async deleteOperatingHour(id: string, actor?: ActorContext) {
    try {
      await this.assertCanManageOperatingHour(id, actor);

      const operatingHour = await this.db.operatingHour.delete({
        where: { operatingHourId: id }
      });

      return toOperatingHourDto(operatingHour);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError(404, "Operating hour not found", "OPERATING_HOUR_NOT_FOUND");
      }

      throw error;
    }
  }

  async listPricingRules(courtId: string, actor?: ActorContext) {
    await this.assertCourtExists(courtId);
    await this.assertCanManageCourt(courtId, actor);

    const pricingRules = await this.db.pricingRule.findMany({
      where: { courtId },
      include: { priorityGroup: true },
      orderBy: [{ priorityOrder: "asc" }, { applicableDay: "asc" }, { startTime: "asc" }]
    });

    return pricingRules.map(toPricingRuleDto);
  }

  async createPricingRule(courtId: string, actor: ActorContext, input: CreatePricingRuleInput) {
    try {
      await this.assertCourtExists(courtId);
      await this.assertCanManageCourt(courtId, actor);

      const priorityOrder = input.priorityOrder ?? await this.getNextPricingRulePriorityOrder(courtId);
      const pricingRule = await this.db.pricingRule.create({
        data: {
          ...input,
          courtId,
          createdByUserId: actor.actorUserId,
          priorityOrder
        },
        include: { priorityGroup: true }
      });

      return toPricingRuleDto(pricingRule);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async updatePricingRule(id: string, input: UpdatePricingRuleInput, actor?: ActorContext) {
    try {
      await this.assertCanManagePricingRule(id, actor);

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

  async updatePricingRuleStatus(id: string, input: UpdateEntityStatusInput, actor?: ActorContext) {
    try {
      await this.assertCanManagePricingRule(id, actor);

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

  async deletePricingRule(id: string, actor?: ActorContext) {
    try {
      await this.assertCanManagePricingRule(id, actor);

      const pricingRule = await this.db.pricingRule.delete({
        where: { pricingRuleId: id },
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

  private isAdmin(actor?: ActorContext): boolean {
    return actor?.roles.includes("ADMIN") ?? false;
  }

  private isFieldManagerOnly(actor?: ActorContext): actor is ActorContext {
    return Boolean(actor?.roles.includes("FIELD_MANAGER") && !this.isAdmin(actor));
  }

  private async assertCanManageCourt(
    courtId: string,
    actor?: ActorContext,
    db: CourtDbClient = this.db
  ): Promise<void> {
    if (!this.isFieldManagerOnly(actor)) {
      return;
    }

    const assignment = await db.courtManagerAssignment.findUnique({
      where: {
        courtId_userId: {
          courtId,
          userId: actor.actorUserId
        }
      },
      select: { courtId: true }
    });

    if (!assignment) {
      throw new AppError(
        403,
        "Field manager is not assigned to this court",
        "COURT_MANAGER_ASSIGNMENT_REQUIRED"
      );
    }
  }

  private async assertCanManageOperatingHour(id: string, actor?: ActorContext): Promise<void> {
    if (!this.isFieldManagerOnly(actor)) {
      return;
    }

    const operatingHour = await this.db.operatingHour.findUnique({
      where: { operatingHourId: id },
      select: { courtId: true }
    });

    if (!operatingHour) {
      throw new AppError(404, "Operating hour not found", "OPERATING_HOUR_NOT_FOUND");
    }

    await this.assertCanManageCourt(operatingHour.courtId, actor);
  }

  private async assertCanManagePricingRule(id: string, actor?: ActorContext): Promise<void> {
    if (!this.isFieldManagerOnly(actor)) {
      return;
    }

    const pricingRule = await this.db.pricingRule.findUnique({
      where: { pricingRuleId: id },
      select: { courtId: true }
    });

    if (!pricingRule) {
      throw new AppError(404, "Pricing rule not found", "PRICING_RULE_NOT_FOUND");
    }

    await this.assertCanManageCourt(pricingRule.courtId, actor);
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

  private async getNextPricingRulePriorityOrder(courtId: string): Promise<number> {
    const latestRule = await this.db.pricingRule.findFirst({
      where: { courtId },
      orderBy: { priorityOrder: "desc" },
      select: { priorityOrder: true }
    });

    return (latestRule?.priorityOrder ?? 0) + 1;
  }
}

export const courtsService = new CourtsService();
