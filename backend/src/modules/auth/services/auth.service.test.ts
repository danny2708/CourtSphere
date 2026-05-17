import { AccountStatus, BookingPermissionStatus, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { RbacService } from "./rbac.service";
import { TokenService } from "./token.service";

const passwordService = new PasswordService();

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    userId: "00000000-0000-0000-0000-000000000001",
    fullName: "Sample User",
    email: "user@courtsphere.local",
    phoneNumber: null,
    passwordHash: "hash",
    identityCode: null,
    accountStatus: AccountStatus.ACTIVE,
    bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
    priorityGroup: {
      priorityGroupId: "00000000-0000-0000-0000-000000000011",
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

function buildServiceWithUserFindUnique(user: unknown): AuthService {
  return new AuthService({
    user: {
      findUnique: vi.fn().mockResolvedValue(user)
    }
  } as unknown as PrismaClient);
}

describe("PasswordService", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await passwordService.hashPassword("correct-password");

    expect(hash).not.toBe("correct-password");
    await expect(passwordService.verifyPassword("correct-password", hash)).resolves.toBe(true);
    await expect(passwordService.verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});

describe("TokenService", () => {
  it("creates and verifies access tokens", () => {
    const tokenService = new TokenService();
    const token = tokenService.createAccessToken({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "user@courtsphere.local",
      roles: ["USER"]
    });

    const payload = tokenService.verifyAccessToken(token);

    expect(payload.sub).toBe("00000000-0000-0000-0000-000000000001");
    expect(payload.email).toBe("user@courtsphere.local");
    expect(payload.roles).toEqual(["USER"]);
  });
});

describe("RbacService", () => {
  it("checks supported roles", () => {
    const rbacService = new RbacService();

    expect(rbacService.hasAnyRole(["USER"], ["ADMIN"])).toBe(false);
    expect(rbacService.hasAnyRole(["FIELD_MANAGER"], ["FIELD_MANAGER", "ADMIN"])).toBe(true);
    expect(rbacService.hasAnyRole(["UNKNOWN"], ["USER"])).toBe(false);
  });
});

describe("AuthService", () => {
  it("rejects register when email already exists", async () => {
    const service = new AuthService({
      user: {
        findFirst: vi.fn().mockResolvedValue({ email: "taken@example.com" })
      }
    } as unknown as PrismaClient);

    await expect(
      service.register({
        fullName: "Taken User",
        email: "taken@example.com",
        password: "password123",
        confirmPassword: "password123",
        priorityGroupCode: "STUDENT"
      })
    ).rejects.toMatchObject({
      code: "EMAIL_ALREADY_EXISTS",
      statusCode: 409
    });
  });

  it("rejects login with the wrong password", async () => {
    const passwordHash = await passwordService.hashPassword("correct-password");
    const service = buildServiceWithUserFindUnique(buildUser({ passwordHash }));

    await expect(
      service.login({
        email: "user@courtsphere.local",
        password: "wrong-password"
      })
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      statusCode: 401
    });
  });

  it("rejects login for locked accounts", async () => {
    const passwordHash = await passwordService.hashPassword("correct-password");
    const service = buildServiceWithUserFindUnique(
      buildUser({
        passwordHash,
        accountStatus: AccountStatus.LOCKED
      })
    );

    await expect(
      service.login({
        email: "user@courtsphere.local",
        password: "correct-password"
      })
    ).rejects.toMatchObject({
      code: "ACCOUNT_LOCKED",
      statusCode: 403
    });
  });

  it("rejects login for disabled accounts", async () => {
    const passwordHash = await passwordService.hashPassword("correct-password");
    const service = buildServiceWithUserFindUnique(
      buildUser({
        passwordHash,
        accountStatus: AccountStatus.DISABLED
      })
    );

    await expect(
      service.login({
        email: "user@courtsphere.local",
        password: "correct-password"
      })
    ).rejects.toMatchObject({
      code: "ACCOUNT_DISABLED",
      statusCode: 403
    });
  });
});
