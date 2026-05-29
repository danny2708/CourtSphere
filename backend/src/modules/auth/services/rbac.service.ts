export type RoleName = "USER" | "FIELD_MANAGER" | "ADMIN";

const supportedRoles: RoleName[] = ["USER", "FIELD_MANAGER", "ADMIN"];

export class RbacService {
  isSupportedRole(role: string): role is RoleName {
    return supportedRoles.includes(role as RoleName);
  }

  hasAnyRole(userRoles: string[], allowedRoles: RoleName[]): boolean {
    return userRoles.some((role) => this.isSupportedRole(role) && allowedRoles.includes(role));
  }
}

export const rbacService = new RbacService();
