import { AccountStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import { AppError } from "../../../middlewares/error.middleware";
import type { AuthResponse, AuthUserDto, LoginInput, RegisterInput } from "../auth.types";
import { passwordService, type PasswordService } from "./password.service";
import { tokenService, type TokenService } from "./token.service";

const userInclude = {
  priorityGroup: true,
  userRoles: {
    include: {
      role: true
    }
  }
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

function toAuthUserDto(user: UserWithRelations): AuthUserDto {
  return {
    id: user.userId,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    identityCode: user.identityCode,
    accountStatus: user.accountStatus,
    bookingPermissionStatus: user.bookingPermissionStatus,
    roles: user.userRoles.map((userRole) => userRole.role.roleName),
    priorityGroup: user.priorityGroup
      ? {
          id: user.priorityGroup.priorityGroupId,
          code: user.priorityGroup.groupCode,
          name: user.priorityGroup.groupName,
          priorityLevel: user.priorityGroup.priorityLevel,
          advanceBookingDays: user.priorityGroup.advanceBookingDays
        }
      : null
  };
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function throwAccountStatusError(accountStatus: AccountStatus): void {
  if (accountStatus === AccountStatus.LOCKED) {
    throw new AppError(403, "Account is locked", "ACCOUNT_LOCKED");
  }

  if (accountStatus === AccountStatus.DISABLED) {
    throw new AppError(403, "Account is disabled", "ACCOUNT_DISABLED");
  }
}

export class AuthService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly passwords: PasswordService = passwordService,
    private readonly tokens: TokenService = tokenService
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const phoneNumber = normalizeOptional(input.phoneNumber);
    const identityCode = normalizeOptional(input.identityCode);

    await this.assertUniqueIdentity({ email, phoneNumber, identityCode });

    const passwordHash = await this.passwords.hashPassword(input.password);

    try {
      const user = await this.db.$transaction(async (tx) => {
        const [priorityGroup, defaultRole] = await Promise.all([
          tx.priorityGroup.findUnique({
            where: { groupCode: input.priorityGroupCode }
          }),
          tx.role.findUnique({
            where: { roleName: "USER" }
          })
        ]);

        if (!priorityGroup) {
          throw new AppError(400, "Priority group is not configured", "PRIORITY_GROUP_NOT_CONFIGURED");
        }

        if (!defaultRole) {
          throw new AppError(500, "Default USER role is not configured", "DEFAULT_ROLE_NOT_CONFIGURED");
        }

        const createdUser = await tx.user.create({
          data: {
            fullName: input.fullName.trim(),
            email,
            phoneNumber,
            identityCode,
            passwordHash,
            priorityGroupId: priorityGroup.priorityGroupId
          }
        });

        await tx.userRole.create({
          data: {
            userId: createdUser.userId,
            roleId: defaultRole.roleId
          }
        });

        return tx.user.findUniqueOrThrow({
          where: { userId: createdUser.userId },
          include: userInclude
        });
      });

      return this.createAuthResponse(user);
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.db.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: userInclude
    });

    if (!user) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    const passwordMatches = await this.passwords.verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    throwAccountStatusError(user.accountStatus);

    return this.createAuthResponse(user);
  }

  async getCurrentUser(userId: string): Promise<AuthUserDto> {
    const user = await this.db.user.findUnique({
      where: { userId },
      include: userInclude
    });

    if (!user) {
      throw new AppError(401, "Authenticated user no longer exists", "UNAUTHENTICATED");
    }

    throwAccountStatusError(user.accountStatus);

    return toAuthUserDto(user);
  }

  async assertUniqueIdentity(input: {
    email: string;
    phoneNumber?: string;
    identityCode?: string;
  }): Promise<void> {
    const existingUser = await this.db.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          ...(input.phoneNumber ? [{ phoneNumber: input.phoneNumber }] : []),
          ...(input.identityCode ? [{ identityCode: input.identityCode }] : [])
        ]
      }
    });

    if (!existingUser) {
      return;
    }

    if (existingUser.email === input.email) {
      throw new AppError(409, "Email is already registered", "EMAIL_ALREADY_EXISTS");
    }

    if (input.phoneNumber && existingUser.phoneNumber === input.phoneNumber) {
      throw new AppError(409, "Phone number is already registered", "PHONE_ALREADY_EXISTS");
    }

    if (input.identityCode && existingUser.identityCode === input.identityCode) {
      throw new AppError(409, "Identity code is already registered", "IDENTITY_CODE_ALREADY_EXISTS");
    }
  }

  private createAuthResponse(user: UserWithRelations): AuthResponse {
    const dto = toAuthUserDto(user);

    return {
      accessToken: this.tokens.createAccessToken({
        userId: dto.id,
        email: dto.email,
        roles: dto.roles
      }),
      tokenType: "Bearer",
      user: dto
    };
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
  }
}

export const authService = new AuthService();
