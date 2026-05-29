import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { rulesController, type RulesController } from "./rules.controller";
import {
  configIdParamSchema,
  updateBookingRulesSchema,
  updatePriorityGroupSchema,
  updatePriorityPolicySchema
} from "./rules.validation";

export function createRulesRouter(controller: RulesController = rulesController): Router {
  const router = Router();

  router.use(requireAuth, requireRole(["ADMIN"]));

  router.get("/booking-rules", asyncHandler(controller.getBookingRules));
  router.put(
    "/booking-rules",
    validateRequest({ body: updateBookingRulesSchema }),
    asyncHandler(controller.updateBookingRules)
  );

  router.get("/priority-groups", asyncHandler(controller.listPriorityGroups));
  router.put(
    "/priority-groups/:id",
    validateRequest({ params: configIdParamSchema, body: updatePriorityGroupSchema }),
    asyncHandler(controller.updatePriorityGroup)
  );

  router.get("/priority-policies", asyncHandler(controller.listPriorityPolicies));
  router.put(
    "/priority-policies/:id",
    validateRequest({ params: configIdParamSchema, body: updatePriorityPolicySchema }),
    asyncHandler(controller.updatePriorityPolicy)
  );

  return router;
}

export default createRulesRouter();
