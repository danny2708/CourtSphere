import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

import { AppError } from "./error.middleware";

type RequestSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

function parseSchema(schema: ZodTypeAny, value: unknown, target: string): unknown {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new AppError(
      400,
      `Invalid request ${target}`,
      "VALIDATION_ERROR",
      parsed.error.flatten()
    );
  }

  return parsed.data;
}

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = parseSchema(schemas.body, req.body, "body");
      }

      if (schemas.query) {
        Object.defineProperty(req, "query", {
          value: parseSchema(schemas.query, req.query, "query"),
          configurable: true,
          enumerable: true,
          writable: true
        });
      }

      if (schemas.params) {
        req.params = parseSchema(schemas.params, req.params, "params") as typeof req.params;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
