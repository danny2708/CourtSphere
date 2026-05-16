import { env } from "../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

type LogContext = Record<string, unknown>;

function shouldLog(level: LogLevel): boolean {
  return levelWeights[level] >= levelWeights[env.LOG_LEVEL];
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context
  };

  const line = JSON.stringify(payload);

  if (level === "debug") {
    console.log(line);
    return;
  }

  console[level](line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context)
};
