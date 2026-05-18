import { EntityStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import type {
  AuditContext,
  BookingRulesInput,
  PriorityGroupInput,
  PriorityPolicyInput
} from "./rules.types";
import {
  FALLBACK_BOOKING_RULES,
  RulesRepository,
  rulesRepository,
  type BookingRuleRecord,
  type PriorityPolicyRecord
} from "./rules.repository";

function normalizeOptional(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toBookingRuleDto(rule: BookingRuleRecord | typeof FALLBACK_BOOKING_RULES) {
  return {
    id: "bookingRuleId" in rule ? rule.bookingRuleId : null,
    ruleName: rule.ruleName,
    maxBookingsPerDay: rule.maxBookingsPerDay,
    maxDurationMinutes: rule.maxDurationMinutes,
    holdMinutes: rule.holdMinutes,
    cancelBeforeHours: rule.cancelBeforeHours,
    lateCheckinMinutes: rule.lateCheckinMinutes,
    violationThreshold: rule.violationThreshold,
    bookingBanDays: rule.bookingBanDays,
    refundRateUserOnTime: rule.refundRateUserOnTime,
    refundRateManagerFault: rule.refundRateManagerFault,
    status: "status" in rule ? rule.status : EntityStatus.ACTIVE,
    updatedByUserId: "updatedByUserId" in rule ? rule.updatedByUserId : null,
    createdAt: "createdAt" in rule ? rule.createdAt : null,
    updatedAt: "updatedAt" in rule ? rule.updatedAt : null
  };
}

function toPriorityGroupDto(
  group: Prisma.PriorityGroupGetPayload<{
    select: typeof priorityGroupSelect;
  }>
) {
  return {
    id: group.priorityGroupId,
    groupCode: group.groupCode,
    groupName: group.groupName,
    priorityLevel: group.priorityLevel,
    advanceBookingDays: group.advanceBookingDays,
    description: group.description,
    status: group.status,
    userCount: group._count.users,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  };
}

function toPriorityPolicyDto(policy: PriorityPolicyRecord) {
  return {
    id: policy.priorityPolicyId,
    priorityGroupId: policy.priorityGroupId,
    priorityGroup: {
      id: policy.priorityGroup.priorityGroupId,
      groupCode: policy.priorityGroup.groupCode,
      groupName: policy.priorityGroup.groupName
    },
    policyName: policy.policyName,
    priorityRank: policy.priorityLevel,
    advanceBookingDays: policy.advanceBookingDays,
    maxBookingsPerDay: policy.maxBookingsPerDay,
    maxDurationMinutes: policy.maxDurationMinutes,
    canJoinWaitlist: policy.canJoinWaitlist,
    canBookPrioritySlots: policy.canBookPrioritySlots,
    status: policy.status,
    updatedByUserId: policy.updatedByUserId,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt
  };
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function handleKnownPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : "";

      if (target.includes("group_code") || target.includes("groupCode")) {
        throw new AppError(409, "Priority group code already exists", "GROUP_CODE_ALREADY_EXISTS");
      }

      if (target.includes("group_name") || target.includes("groupName")) {
        throw new AppError(409, "Priority group name already exists", "GROUP_NAME_ALREADY_EXISTS");
      }

      throw new AppError(409, "Unique constraint violation", "UNIQUE_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2003") {
      throw new AppError(400, "Related resource does not exist", "FOREIGN_KEY_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2025") {
      throw new AppError(404, "Config resource not found", "CONFIG_RESOURCE_NOT_FOUND");
    }
  }

  throw error;
}

const priorityGroupSelect = {
  priorityGroupId: true,
  groupCode: true,
  groupName: true,
  priorityLevel: true,
  advanceBookingDays: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      users: true
    }
  }
} satisfies Prisma.PriorityGroupSelect;

export class RulesService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly repository: RulesRepository = rulesRepository
  ) {}

  async getBookingRules() {
    return toBookingRuleDto(await this.repository.getBookingRuleForPolicy());
  }

  async updateBookingRules(input: BookingRulesInput, audit: AuditContext) {
    try {
      return await this.db.$transaction(async (tx) => {
        const currentRule = await tx.bookingRule.findFirst({
          where: { status: EntityStatus.ACTIVE },
          orderBy: [{ updatedAt: "desc" }]
        });
        const baseRule = currentRule ?? FALLBACK_BOOKING_RULES;
        const data = {
          ruleName: baseRule.ruleName,
          holdMinutes: input.holdMinutes ?? baseRule.holdMinutes,
          cancelBeforeHours: input.cancelBeforeHours ?? baseRule.cancelBeforeHours,
          lateCheckinMinutes: input.lateCheckinMinutes ?? baseRule.lateCheckinMinutes,
          maxBookingsPerDay: input.maxBookingsPerDay ?? baseRule.maxBookingsPerDay,
          maxDurationMinutes: input.maxDurationMinutes ?? baseRule.maxDurationMinutes,
          violationThreshold: input.violationThreshold ?? baseRule.violationThreshold,
          bookingBanDays: input.bookingBanDays ?? baseRule.bookingBanDays,
          refundRateUserOnTime: input.refundRateUserOnTime ?? baseRule.refundRateUserOnTime,
          refundRateManagerFault: input.refundRateManagerFault ?? baseRule.refundRateManagerFault,
          status: EntityStatus.ACTIVE,
          updatedByUserId: audit.actorUserId
        };

        const updatedRule = currentRule
          ? await tx.bookingRule.update({
              where: { bookingRuleId: currentRule.bookingRuleId },
              data
            })
          : await tx.bookingRule.create({
              data
            });

        await this.createAuditLog(tx, audit, {
          entityType: "BOOKING_RULE",
          entityId: updatedRule.bookingRuleId,
          action: "ADMIN_UPDATE_BOOKING_RULES",
          oldValue: toBookingRuleDto(baseRule),
          newValue: toBookingRuleDto(updatedRule)
        });

        return toBookingRuleDto(updatedRule);
      });
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async listPriorityGroups() {
    const groups = await this.db.priorityGroup.findMany({
      select: priorityGroupSelect,
      orderBy: [{ priorityLevel: "asc" }, { groupCode: "asc" }]
    });

    return groups.map(toPriorityGroupDto);
  }

  async updatePriorityGroup(id: string, input: PriorityGroupInput, audit: AuditContext) {
    try {
      return await this.db.$transaction(async (tx) => {
        const currentGroup = await tx.priorityGroup.findUnique({
          where: { priorityGroupId: id },
          select: priorityGroupSelect
        });

        if (!currentGroup) {
          throw new AppError(404, "Priority group not found", "PRIORITY_GROUP_NOT_FOUND");
        }

        const updatedGroup = await tx.priorityGroup.update({
          where: { priorityGroupId: id },
          data: {
            ...(input.groupCode !== undefined ? { groupCode: input.groupCode } : {}),
            ...(input.groupName !== undefined ? { groupName: input.groupName } : {}),
            ...(input.priorityLevel !== undefined ? { priorityLevel: input.priorityLevel } : {}),
            ...(input.advanceBookingDays !== undefined
              ? { advanceBookingDays: input.advanceBookingDays }
              : {}),
            ...(input.description !== undefined ? { description: normalizeOptional(input.description) } : {}),
            ...(input.status !== undefined ? { status: input.status } : {})
          },
          select: priorityGroupSelect
        });

        await this.createAuditLog(tx, audit, {
          entityType: "PRIORITY_GROUP",
          entityId: id,
          action: "ADMIN_UPDATE_PRIORITY_GROUP",
          oldValue: toPriorityGroupDto(currentGroup),
          newValue: toPriorityGroupDto(updatedGroup)
        });

        return toPriorityGroupDto(updatedGroup);
      });
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async listPriorityPolicies() {
    const policies = await this.db.priorityPolicy.findMany({
      include: { priorityGroup: true },
      orderBy: [{ priorityLevel: "asc" }, { policyName: "asc" }]
    });

    return policies.map(toPriorityPolicyDto);
  }

  async updatePriorityPolicy(id: string, input: PriorityPolicyInput, audit: AuditContext) {
    try {
      return await this.db.$transaction(async (tx) => {
        const currentPolicy = await tx.priorityPolicy.findUnique({
          where: { priorityPolicyId: id },
          include: { priorityGroup: true }
        });

        if (!currentPolicy) {
          throw new AppError(404, "Priority policy not found", "PRIORITY_POLICY_NOT_FOUND");
        }

        const updatedPolicy = await tx.priorityPolicy.update({
          where: { priorityPolicyId: id },
          data: {
            ...(input.priorityGroupId !== undefined ? { priorityGroupId: input.priorityGroupId } : {}),
            ...(input.priorityRank !== undefined ? { priorityLevel: input.priorityRank } : {}),
            ...(input.advanceBookingDays !== undefined
              ? { advanceBookingDays: input.advanceBookingDays }
              : {}),
            ...(input.maxBookingsPerDay !== undefined
              ? { maxBookingsPerDay: input.maxBookingsPerDay }
              : {}),
            ...(input.canJoinWaitlist !== undefined
              ? { canJoinWaitlist: input.canJoinWaitlist }
              : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            updatedByUserId: audit.actorUserId
          },
          include: { priorityGroup: true }
        });

        await this.createAuditLog(tx, audit, {
          entityType: "PRIORITY_POLICY",
          entityId: id,
          action: "ADMIN_UPDATE_PRIORITY_POLICY",
          oldValue: toPriorityPolicyDto(currentPolicy),
          newValue: toPriorityPolicyDto(updatedPolicy)
        });

        return toPriorityPolicyDto(updatedPolicy);
      });
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient,
    audit: AuditContext,
    input: {
      entityType: string;
      entityId: string;
      action: string;
      oldValue: unknown;
      newValue: unknown;
    }
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId: audit.actorUserId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue: jsonSafe(input.oldValue),
        newValue: jsonSafe(input.newValue),
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      }
    });
  }
}

export const rulesService = new RulesService();
