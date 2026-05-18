import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import {
  availabilityParamsSchema,
  availabilityQuerySchema
} from "./availability.validation";
import {
  availabilityController,
  type AvailabilityController
} from "./availability.controller";

export function createAvailabilityRouter(
  controller: AvailabilityController = availabilityController
): Router {
  const router = Router();

  router.get(
    "/courts/:id/availability",
    requireAuth,
    validateRequest({ params: availabilityParamsSchema, query: availabilityQuerySchema }),
    asyncHandler(controller.getCourtAvailability)
  );

  return router;
}

export default createAvailabilityRouter();
