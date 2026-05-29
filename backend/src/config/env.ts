import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/courtsphere?schema=public"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  JWT_ACCESS_SECRET: z.string().min(32).default("local-development-jwt-secret-change-me"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("1h"),
  MOCK_PAYMENT_SECRET: z.string().min(16).default("local-mock-payment-secret"),
  PAYMENT_GATEWAY: z.enum(["mock", "momo"]).default("mock"),
  FRONTEND_BASE_URL: z.string().url().default("http://localhost:5173"),
  BACKEND_PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  MOMO_ENDPOINT: z.string().url().default("https://test-payment.momo.vn/v2/gateway/api/create"),
  MOMO_PARTNER_CODE: z.string().default(""),
  MOMO_ACCESS_KEY: z.string().default(""),
  MOMO_SECRET_KEY: z.string().default(""),
  MOMO_PARTNER_NAME: z.string().default("CourtSphere"),
  MOMO_STORE_ID: z.string().default("CourtSphereStore"),
  MOMO_REDIRECT_URL: z.string().url().optional(),
  MOMO_IPN_URL: z.string().url().optional(),
  MOMO_REQUEST_TYPE: z.string().default("payWithMethod"),
  MOMO_LANG: z.enum(["vi", "en"]).default("vi")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsedEnv.data;

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
