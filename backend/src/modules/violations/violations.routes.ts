import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { violationsController, type ViolationsController } from "./violations.controller";
import {
  adjustViolationPointsSchema,
  listViolationsQuerySchema,
  violationIdParamsSchema,
  waiveViolationSchema
} from "./violations.validators";

export function createViolationsRouter(
  controller: ViolationsController = violationsController
): Router {
  const router = Router();

  router.get(
    "/violations",
    requireAuth,
    requireRole(["ADMIN", "FIELD_MANAGER"]),
    validateRequest({ query: listViolationsQuerySchema }),
    asyncHandler(controller.listViolations)
  );
  router.post(
    "/violations/:id/waive",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: violationIdParamsSchema, body: waiveViolationSchema }),
    asyncHandler(controller.waiveViolation)
  );
  router.post(
    "/violations/:id/adjust-points",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: violationIdParamsSchema, body: adjustViolationPointsSchema }),
    asyncHandler(controller.adjustViolationPoints)
  );

  return router;
}

export default createViolationsRouter();
