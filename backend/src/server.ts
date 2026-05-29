import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { logger } from "./utils/logger";

const server = app.listen(env.PORT, () => {
  logger.info("server.started", {
    port: env.PORT,
    environment: env.NODE_ENV
  });
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info("server.shutdown.started", { signal });

  server.close(async () => {
    await prisma.$disconnect();
    logger.info("server.shutdown.completed");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("server.shutdown.timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
