import { AccountStatus, BookingPermissionStatus, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { UsersService } from "./users.service";

const actorUserId = "00000000-0000-4000-8000-000000000201";
const targetUserId = "00000000-0000-4000-8000-000000000202";
const roleId = "00000000-0000-4000-8000-000000000203";

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    userId: targetUserId,
    priorityGroupId: "00000000-0000-4000-8000-000000000204",
    fullName: "Sample User",
    email: "sample@example.edu",
    phoneNumber: null,
    passwordHash: "hash",
    identityCode: null,
    accountStatus: AccountStatus.ACTIVE,
    bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
    bookingLockedUntil: null,
    violationPoints: 0,
    reputationPoints: 100,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    updatedAt: new Date("2026-05-17T00:00:00.000Z"),
    priorityGroup: {
      priorityGroupId: "00000000-0000-4000-8000-000000000204",
      groupName: "STUDENT",
      priorityLevel: 2,
      advanceBookingDays: 7
    },
    userRoles: [
      {
        role: {
          roleName: "USER"
        }
      }
    ],
    ...overrides
  };
}

describe("UsersService", () => {
  it("assigns an additional role without removing existing roles and writes an audit log", async () => {
    const auditLogCreate = vi.fn().mockResolvedValue({});
    const userRoleUpsert = vi.fn().mockResolvedValue({});
    const tx = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ userId: targetUserId })
          .mockResolvedValueOnce(
            buildUser({
              userRoles: [
                { role: { roleName: "USER" } },
                { role: { roleName: "FIELD_MANAGER" } }
              ]
            })
          )
      },
      role: {
        findUnique: vi.fn().mockResolvedValue({
          roleId,
          roleName: "FIELD_MANAGER"
        })
      },
      userRole: {
        upsert: userRoleUpsert
      },
      auditLog: {
        create: auditLogCreate
      }
    };
    const service = new UsersService({
      $transaction: vi.fn((callback) => callback(tx))
    } as unknown as PrismaClient);

    const user = await service.assignRole(
      targetUserId,
      { roleName: "FIELD_MANAGER" },
      { actorUserId }
    );

    expect(user.roles).toEqual(["USER", "FIELD_MANAGER"]);
    expect(userRoleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          userId: targetUserId,
          roleId
        }
      })
    );
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId,
          entityType: "USER",
          entityId: targetUserId,
          action: "ADMIN_ASSIGN_ROLE",
          newValue: { roleName: "FIELD_MANAGER" }
        })
      })
    );
  });

  it("updates account status and writes an audit log", async () => {
    const auditLogCreate = vi.fn().mockResolvedValue({});
    const updatedUser = buildUser({ accountStatus: AccountStatus.LOCKED });
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue(buildUser()),
        update: vi.fn().mockResolvedValue(updatedUser)
      },
      auditLog: {
        create: auditLogCreate
      }
    };
    const service = new UsersService({
      $transaction: vi.fn((callback) => callback(tx))
    } as unknown as PrismaClient);

    const user = await service.updateAccountStatus(
      targetUserId,
      { accountStatus: AccountStatus.LOCKED, reason: "Policy violation" },
      { actorUserId }
    );

    expect(user.accountStatus).toBe(AccountStatus.LOCKED);
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId,
          entityType: "USER",
          entityId: targetUserId,
          action: "ADMIN_UPDATE_ACCOUNT_STATUS",
          oldValue: { accountStatus: "ACTIVE" },
          newValue: {
            accountStatus: "LOCKED",
            reason: "Policy violation"
          }
        })
      })
    );
  });
});
