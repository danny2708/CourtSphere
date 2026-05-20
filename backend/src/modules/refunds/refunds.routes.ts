import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { refundsController, type RefundsController } from "./refunds.controller";
import {
  adminListRefundsQuerySchema,
  managerCancelBookingParamsSchema,
  managerCancelBookingSchema,
  refundIdParamsSchema,
  retryRefundSchema
} from "./refunds.validators";

export function createRefundsRouter(
  controller: RefundsController = refundsController
): Router {
  const router = Router();

  router.get(
    "/admin/refunds",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ query: adminListRefundsQuerySchema }),
    asyncHandler(controller.listRefundsForAdmin)
  );
  router.get(
    "/admin/refunds/:id",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: refundIdParamsSchema }),
    asyncHandler(controller.getRefundDetailForAdmin)
  );
  router.post(
    "/admin/refunds/:id/retry",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ params: refundIdParamsSchema, body: retryRefundSchema }),
    asyncHandler(controller.retryRefund)
  );
  router.post(
    "/manager/bookings/:id/cancel",
    requireAuth,
    requireRole(["FIELD_MANAGER", "ADMIN"]),
    validateRequest({
      params: managerCancelBookingParamsSchema,
      body: managerCancelBookingSchema
    }),
    asyncHandler(controller.cancelBookingDueToCourtIssue)
  );

  return router;
}

export default createRefundsRouter();
