import { EntityStatus, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { RulesService } from "./rules.service";

const actorUserId = "00000000-0000-4000-8000-000000000601";
const bookingRuleId = "00000000-0000-4000-8000-000000000602";
const priorityGroupId = "00000000-0000-4000-8000-000000000603";
const priorityPolicyId = "00000000-0000-4000-8000-000000000604";

const audit = {
  actorUserId,
  ipAddress: "127.0.0.1",
  userAgent: "vitest"
};

function buildBookingRule(overrides: Record<string, unknown> = {}) {
  return {
    bookingRuleId,
    ruleName: "DEFAULT",
    maxBookingsPerDay: 2,
    maxDurationMinutes: 120,
    holdMinutes: 10,
    cancelBeforeHours: 2,
    lateCheckinMinutes: 15,
    violationThreshold: 3,
    bookingBanDays: 7,
    refundRateUserOnTime: 100,
    refundRateManagerFault: 100,
    status: EntityStatus.ACTIVE,
    updatedByUserId: null,
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
    ...overrides
  };
}

function buildPriorityGroup(overrides: Record<string, unknown> = {}) {
  return {
    priorityGroupId,
    groupCode: "STUDENT",
    groupName: "Student",
    priorityLevel: 2,
    advanceBookingDays: 7,
    description: "Student users",
    status: EntityStatus.ACTIVE,
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
    _count: {
      users: 3
    },
    ...overrides
  };
}

function buildPriorityPolicy(overrides: Record<string, unknown> = {}) {
  return {
    priorityPolicyId,
    priorityGroupId,
    policyName: "Student Policy",
    priorityLevel: 2,
    advanceBookingDays: 7,
    maxBookingsPerDay: 2,
    maxDurationMinutes: 120,
    canBookPrioritySlots: true,
    canJoinWaitlist: true,
    status: EntityStatus.ACTIVE,
    updatedByUserId: null,
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
    priorityGroup: buildPriorityGroup(),
    ...overrides
  };
}

describe("RulesService", () => {
  it("updates booking rules and writes an audit log", async () => {
    const auditLogCreate = vi.fn().mockResolvedValue({});
    const tx = {
      bookingRule: {
        findFirst: vi.fn().mockResolvedValue(buildBookingRule()),
        update: vi.fn().mockResolvedValue(
          buildBookingRule({
            holdMinutes: 15,
            refundRateUserOnTime: 80,
            updatedByUserId: actorUserId
          })
        ),
        create: vi.fn()
      },
      auditLog: {
        create: auditLogCreate
      }
    };
    const service = new RulesService({
      $transaction: vi.fn((callback) => callback(tx))
    } as unknown as PrismaClient);

    const bookingRules = await service.updateBookingRules(
      {
        holdMinutes: 15,
        refundRateUserOnTime: 80
      },
      audit
    );

    expect(bookingRules).toMatchObject({
      holdMinutes: 15,
      refundRateUserOnTime: 80,
      updatedByUserId: actorUserId
    });
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId,
          entityType: "BOOKING_RULE",
          entityId: bookingRuleId,
          action: "ADMIN_UPDATE_BOOKING_RULES",
          oldValue: expect.objectContaining({ holdMinutes: 10 }),
          newValue: expect.objectContaining({ holdMinutes: 15, refundRateUserOnTime: 80 })
        })
      })
    );
  });

  it("updates a priority group and writes an audit log", async () => {
    const auditLogCreate = vi.fn().mockResolvedValue({});
    const tx = {
      priorityGroup: {
        findUnique: vi.fn().mockResolvedValue(buildPriorityGroup()),
        update: vi.fn().mockResolvedValue(
          buildPriorityGroup({
            groupCode: "STUDENT_FAST",
            advanceBookingDays: 10
          })
        )
      },
      auditLog: {
        create: auditLogCreate
      }
    };
    const service = new RulesService({
      $transaction: vi.fn((callback) => callback(tx))
    } as unknown as PrismaClient);

    const group = await service.updatePriorityGroup(
      priorityGroupId,
      {
        groupCode: "STUDENT_FAST",
        advanceBookingDays: 10
      },
      audit
    );

    expect(group).toMatchObject({
      groupCode: "STUDENT_FAST",
      advanceBookingDays: 10
    });
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId,
          entityType: "PRIORITY_GROUP",
          entityId: priorityGroupId,
          action: "ADMIN_UPDATE_PRIORITY_GROUP",
          oldValue: expect.objectContaining({ groupCode: "STUDENT" }),
          newValue: expect.objectContaining({ groupCode: "STUDENT_FAST" })
        })
      })
    );
  });

  it("updates a priority policy and writes an audit log", async () => {
    const auditLogCreate = vi.fn().mockResolvedValue({});
    const tx = {
      priorityPolicy: {
        findUnique: vi.fn().mockResolvedValue(buildPriorityPolicy()),
        update: vi.fn().mockResolvedValue(
          buildPriorityPolicy({
            priorityLevel: 1,
            maxBookingsPerDay: 4,
            canJoinWaitlist: false,
            updatedByUserId: actorUserId
          })
        )
      },
      auditLog: {
        create: auditLogCreate
      }
    };
    const service = new RulesService({
      $transaction: vi.fn((callback) => callback(tx))
    } as unknown as PrismaClient);

    const policy = await service.updatePriorityPolicy(
      priorityPolicyId,
      {
        priorityRank: 1,
        maxBookingsPerDay: 4,
        canJoinWaitlist: false
      },
      audit
    );

    expect(policy).toMatchObject({
      priorityRank: 1,
      maxBookingsPerDay: 4,
      canJoinWaitlist: false,
      updatedByUserId: actorUserId
    });
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId,
          entityType: "PRIORITY_POLICY",
          entityId: priorityPolicyId,
          action: "ADMIN_UPDATE_PRIORITY_POLICY",
          oldValue: expect.objectContaining({ priorityRank: 2 }),
          newValue: expect.objectContaining({
            priorityRank: 1,
            maxBookingsPerDay: 4,
            canJoinWaitlist: false
          })
        })
      })
    );
  });
});
