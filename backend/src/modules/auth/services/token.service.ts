import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { env } from "../../../config/env";
import { AppError } from "../../../middlewares/error.middleware";

export type AccessTokenPayload = JwtPayload & {
  sub: string;
  email: string;
  roles: string[];
  type: "access";
};

export class TokenService {
  createAccessToken(input: { userId: string; email: string; roles: string[] }): string {
    const payload: Omit<AccessTokenPayload, "iat" | "exp"> = {
      sub: input.userId,
      email: input.email,
      roles: input.roles,
      type: "access"
    };

    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (
      typeof decoded !== "object" ||
      decoded.type !== "access" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.email !== "string" ||
      !Array.isArray(decoded.roles) ||
      decoded.roles.some((role) => typeof role !== "string")
    ) {
      throw new AppError(401, "Invalid access token payload", "INVALID_ACCESS_TOKEN");
    }

    return decoded as AccessTokenPayload;
  }
}

export const tokenService = new TokenService();
