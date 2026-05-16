import { PrismaClient } from "@prisma/client";

import { env } from "./env";

declare global {
  var prismaClient: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaClient ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (env.NODE_ENV !== "production") {
  globalThis.prismaClient = prisma;
}
