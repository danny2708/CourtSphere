import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { courtsController, type CourtsController } from "./courts.controller";
import {
  courtIdParamSchema,
  createCourtSchema,
  createCourtTypeSchema,
  createOperatingHourSchema,
  createPricingRuleSchema,
  idParamSchema,
  listCourtsQuerySchema,
  updateCourtSchema,
  updateCourtStatusSchema,
  updateCourtTypeSchema,
  updateEntityStatusSchema,
  updateOperatingHourSchema,
  updatePricingRuleSchema
} from "./courts.validation";

export function createCourtsRouter(controller: CourtsController = courtsController): Router {
  const router = Router();

  router.get("/court-types", requireAuth, asyncHandler(controller.listCourtTypes));
  router.get(
    "/courts",
    requireAuth,
    validateRequest({ query: listCourtsQuerySchema }),
    asyncHandler(controller.listCourts)
  );
  router.get(
    "/courts/:id",
    requireAuth,
    validateRequest({ params: idParamSchema }),
    asyncHandler(controller.getCourtDetail)
  );

  router.post(
    "/admin/court-types",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ body: createCourtTypeSchema }),
    asyncHandler(controller.createCourtType)
  );
  router.put(
    "/admin/court-types/:id",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: idParamSchema, body: updateCourtTypeSchema }),
    asyncHandler(controller.updateCourtType)
  );
  router.patch(
    "/admin/court-types/:id/status",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: idParamSchema, body: updateEntityStatusSchema }),
    asyncHandler(controller.updateCourtTypeStatus)
  );

  router.post(
    "/admin/courts",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ body: createCourtSchema }),
    asyncHandler(controller.createCourt)
  );
  router.put(
    "/admin/courts/:id",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: idParamSchema, body: updateCourtSchema }),
    asyncHandler(controller.updateCourt)
  );
  router.patch(
    "/admin/courts/:id/status",
    requireAuth,
    requireRole(["FIELD_MANAGER", "ADMIN"]),
    validateRequest({ params: idParamSchema, body: updateCourtStatusSchema }),
    asyncHandler(controller.updateCourtStatus)
  );

  router.get(
    "/admin/courts/:courtId/operating-hours",
    requireAuth,
    requireRole(["FIELD_MANAGER", "ADMIN"]),
    validateRequest({ params: courtIdParamSchema }),
    asyncHandler(controller.listOperatingHours)
  );
  router.post(
    "/admin/courts/:courtId/operating-hours",
    requireAuth,
    requireRole(["FIELD_MANAGER", "ADMIN"]),
    validateRequest({ params: courtIdParamSchema, body: createOperatingHourSchema }),
    asyncHandler(controller.createOperatingHour)
  );
  router.put(
    "/admin/operating-hours/:id",
    requireAuth,
    requireRole(["FIELD_MANAGER", "ADMIN"]),
    validateRequest({ params: idParamSchema, body: updateOperatingHourSchema }),
    asyncHandler(controller.updateOperatingHour)
  );
  router.patch(
    "/admin/operating-hours/:id/status",
    requireAuth,
    requireRole(["FIELD_MANAGER", "ADMIN"]),
    validateRequest({ params: idParamSchema, body: updateEntityStatusSchema }),
    asyncHandler(controller.updateOperatingHourStatus)
  );

  router.get(
    "/admin/courts/:courtId/pricing-rules",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: courtIdParamSchema }),
    asyncHandler(controller.listPricingRules)
  );
  router.post(
    "/admin/courts/:courtId/pricing-rules",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: courtIdParamSchema, body: createPricingRuleSchema }),
    asyncHandler(controller.createPricingRule)
  );
  router.put(
    "/admin/pricing-rules/:id",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: idParamSchema, body: updatePricingRuleSchema }),
    asyncHandler(controller.updatePricingRule)
  );
  router.patch(
    "/admin/pricing-rules/:id/status",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: idParamSchema, body: updateEntityStatusSchema }),
    asyncHandler(controller.updatePricingRuleStatus)
  );

  return router;
}

export default createCourtsRouter();
