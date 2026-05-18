import { BookingPermissionStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import type {
  AdminListUsersQuery,
  AdminRoleInput,
  AdminUpdateAccountStatusInput,
  AdminUpdateBookingPermissionInput,
  AdminUpdatePriorityGroupInput,
  AdminUpdateUserProfileInput,
  AuditContext
} from "./users.types";

const userInclude = {
  priorityGroup: true,
  userRoles: {
    include: {
      role: true
    },
    orderBy: {
      assignedAt: "asc" as const
    }
  }
} satisfies Prisma.UserInclude;

type AdminUserWithRelations = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

function toAdminUserDto(user: AdminUserWithRelations) {
  return {
    id: user.userId,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    identityCode: user.identityCode,
    accountStatus: user.accountStatus,
    bookingPermissionStatus: user.bookingPermissionStatus,
    bookingLockedUntil: user.bookingLockedUntil,
    violationPoints: user.violationPoints,
    reputationPoints: user.reputationPoints,
    roles: user.userRoles.map((userRole) => userRole.role.roleName),
    priorityGroup: user.priorityGroup
      ? {
          id: user.priorityGroup.priorityGroupId,
          code: user.priorityGroup.groupCode,
          name: user.priorityGroup.groupName,
          priorityLevel: user.priorityGroup.priorityLevel,
          advanceBookingDays: user.priorityGroup.advanceBookingDays
        }
      : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function normalizeNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function dateToJson(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function handleKnownPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : "";

      if (target.includes("email")) {
        throw new AppError(409, "Email is already registered", "EMAIL_ALREADY_EXISTS");
      }

      if (target.includes("phone_number")) {
        throw new AppError(409, "Phone number is already registered", "PHONE_ALREADY_EXISTS");
      }

      if (target.includes("identity_code")) {
        throw new AppError(409, "Identity code is already registered", "IDENTITY_CODE_ALREADY_EXISTS");
      }

      throw new AppError(409, "Unique constraint violation", "UNIQUE_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2003") {
      throw new AppError(400, "Related resource does not exist", "FOREIGN_KEY_CONSTRAINT_VIOLATION");
    }
  }

  throw error;
}

export class UsersService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listUsers(query: AdminListUsersQuery) {
    const where: Prisma.UserWhereInput = {
      ...(query.accountStatus ? { accountStatus: query.accountStatus } : {}),
      ...(query.bookingPermissionStatus
        ? { bookingPermissionStatus: query.bookingPermissionStatus }
        : {}),
      ...(query.priorityGroupId ? { priorityGroupId: query.priorityGroupId } : {}),
      ...(query.roleName
        ? {
            userRoles: {
              some: {
                role: {
                  roleName: query.roleName
                }
              }
            }
          }
        : {}),
      ...(query.keyword
        ? {
            OR: [
              { fullName: { contains: query.keyword, mode: "insensitive" } },
              { email: { contains: query.keyword, mode: "insensitive" } },
              { phoneNumber: { contains: query.keyword, mode: "insensitive" } },
              { identityCode: { contains: query.keyword, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const users = await this.db.user.findMany({
      where,
      include: userInclude,
      orderBy: [{ createdAt: "desc" }]
    });

    return users.map(toAdminUserDto);
  }

  async updateUserProfile(id: string, input: AdminUpdateUserProfileInput, audit: AuditContext) {
    try {
      return await this.db.$transaction(async (tx) => {
        const currentUser = await tx.user.findUnique({
          where: { userId: id },
          include: userInclude
        });

        if (!currentUser) {
          throw new AppError(404, "User not found", "USER_NOT_FOUND");
        }

        const data = {
          ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
          ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
          ...(input.phoneNumber !== undefined
            ? { phoneNumber: normalizeNullable(input.phoneNumber) }
            : {}),
          ...(input.identityCode !== undefined
            ? { identityCode: normalizeNullable(input.identityCode) }
            : {})
        };

        const updatedUser = await tx.user.update({
          where: { userId: id },
          data,
          include: userInclude
        });

        await this.createAuditLog(tx, audit, {
          entityId: id,
          action: "ADMIN_UPDATE_USER_PROFILE",
          oldValue: {
            fullName: currentUser.fullName,
            email: currentUser.email,
            phoneNumber: currentUser.phoneNumber,
            identityCode: currentUser.identityCode
          },
          newValue: {
            fullName: updatedUser.fullName,
            email: updatedUser.email,
            phoneNumber: updatedUser.phoneNumber,
            identityCode: updatedUser.identityCode
          }
        });

        return toAdminUserDto(updatedUser);
      });
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async assignRole(id: string, input: AdminRoleInput, audit: AuditContext) {
    return this.db.$transaction(async (tx) => {
      const [user, role] = await Promise.all([
        tx.user.findUnique({
          where: { userId: id },
          select: { userId: true }
        }),
        tx.role.findUnique({
          where: { roleName: input.roleName }
        })
      ]);

      if (!user) {
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
      }

      if (!role) {
        throw new AppError(404, "Role not found", "ROLE_NOT_FOUND");
      }

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: id,
            roleId: role.roleId
          }
        },
        create: {
          userId: id,
          roleId: role.roleId
        },
        update: {}
      });

      await this.createAuditLog(tx, audit, {
        entityId: id,
        action: "ADMIN_ASSIGN_ROLE",
        oldValue: { roleName: null },
        newValue: { roleName: input.roleName }
      });

      return this.getUserOrThrow(tx, id);
    });
  }

  async removeRole(id: string, input: AdminRoleInput, audit: AuditContext) {
    return this.db.$transaction(async (tx) => {
      const [user, role] = await Promise.all([
        tx.user.findUnique({
          where: { userId: id },
          select: { userId: true }
        }),
        tx.role.findUnique({
          where: { roleName: input.roleName }
        })
      ]);

      if (!user) {
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
      }

      if (!role) {
        throw new AppError(404, "Role not found", "ROLE_NOT_FOUND");
      }

      const deleted = await tx.userRole.deleteMany({
        where: {
          userId: id,
          roleId: role.roleId
        }
      });

      if (deleted.count === 0) {
        throw new AppError(404, "User role not found", "USER_ROLE_NOT_FOUND");
      }

      await this.createAuditLog(tx, audit, {
        entityId: id,
        action: "ADMIN_REMOVE_ROLE",
        oldValue: { roleName: input.roleName },
        newValue: { roleName: null }
      });

      return this.getUserOrThrow(tx, id);
    });
  }

  async updateAccountStatus(
    id: string,
    input: AdminUpdateAccountStatusInput,
    audit: AuditContext
  ) {
    return this.db.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { userId: id },
        include: userInclude
      });

      if (!currentUser) {
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
      }

      const updatedUser = await tx.user.update({
        where: { userId: id },
        data: { accountStatus: input.accountStatus },
        include: userInclude
      });

      await this.createAuditLog(tx, audit, {
        entityId: id,
        action: "ADMIN_UPDATE_ACCOUNT_STATUS",
        oldValue: { accountStatus: currentUser.accountStatus },
        newValue: {
          accountStatus: updatedUser.accountStatus,
          reason: input.reason ?? null
        }
      });

      return toAdminUserDto(updatedUser);
    });
  }

  async updateBookingPermission(
    id: string,
    input: AdminUpdateBookingPermissionInput,
    audit: AuditContext
  ) {
    return this.db.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { userId: id },
        include: userInclude
      });

      if (!currentUser) {
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
      }

      const bookingLockedUntil =
        input.bookingPermissionStatus === BookingPermissionStatus.ALLOWED
          ? null
          : input.bookingLockedUntil ?? null;

      const updatedUser = await tx.user.update({
        where: { userId: id },
        data: {
          bookingPermissionStatus: input.bookingPermissionStatus,
          bookingLockedUntil
        },
        include: userInclude
      });

      await this.createAuditLog(tx, audit, {
        entityId: id,
        action: "ADMIN_UPDATE_BOOKING_PERMISSION",
        oldValue: {
          bookingPermissionStatus: currentUser.bookingPermissionStatus,
          bookingLockedUntil: dateToJson(currentUser.bookingLockedUntil)
        },
        newValue: {
          bookingPermissionStatus: updatedUser.bookingPermissionStatus,
          bookingLockedUntil: dateToJson(updatedUser.bookingLockedUntil),
          reason: input.reason ?? null
        }
      });

      return toAdminUserDto(updatedUser);
    });
  }

  async updatePriorityGroup(
    id: string,
    input: AdminUpdatePriorityGroupInput,
    audit: AuditContext
  ) {
    return this.db.$transaction(async (tx) => {
      const [currentUser, priorityGroup] = await Promise.all([
        tx.user.findUnique({
          where: { userId: id },
          include: userInclude
        }),
        tx.priorityGroup.findUnique({
          where: { priorityGroupId: input.priorityGroupId }
        })
      ]);

      if (!currentUser) {
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
      }

      if (!priorityGroup) {
        throw new AppError(404, "Priority group not found", "PRIORITY_GROUP_NOT_FOUND");
      }

      const updatedUser = await tx.user.update({
        where: { userId: id },
        data: { priorityGroupId: input.priorityGroupId },
        include: userInclude
      });

      await this.createAuditLog(tx, audit, {
        entityId: id,
        action: "ADMIN_UPDATE_PRIORITY_GROUP",
        oldValue: { priorityGroupId: currentUser.priorityGroupId },
        newValue: {
          priorityGroupId: updatedUser.priorityGroupId,
          reason: input.reason ?? null
        }
      });

      return toAdminUserDto(updatedUser);
    });
  }

  private async getUserOrThrow(tx: Prisma.TransactionClient, id: string) {
    const user = await tx.user.findUnique({
      where: { userId: id },
      include: userInclude
    });

    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    return toAdminUserDto(user);
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient,
    audit: AuditContext,
    input: {
      entityId: string;
      action: string;
      oldValue: Prisma.InputJsonObject;
      newValue: Prisma.InputJsonObject;
    }
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId: audit.actorUserId,
        entityType: "USER",
        entityId: input.entityId,
        action: input.action,
        oldValue: input.oldValue,
        newValue: input.newValue,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      }
    });
  }
}

export const usersService = new UsersService();
