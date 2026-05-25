import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { paymentsController, type PaymentsController } from "./payments.controller";
import {
  adminListPaymentsQuerySchema,
  bookingPaymentParamsSchema,
  createPaymentSchema,
  mockPaymentCallbackSchema,
  paymentIdParamsSchema
} from "./payments.validators";

export function createPaymentsRouter(
  controller: PaymentsController = paymentsController
): Router {
  const router = Router();

  router.post(
    "/bookings/:id/payments",
    requireAuth,
    requireRole(["USER"]),
    validateRequest({ params: bookingPaymentParamsSchema, body: createPaymentSchema }),
    asyncHandler(controller.createPaymentForBooking)
  );
  router.post(
    "/payments/callback/mock",
    validateRequest({ body: mockPaymentCallbackSchema }),
    asyncHandler(controller.handleMockCallback)
  );
  router.get(
    "/payments/:id",
    requireAuth,
    validateRequest({ params: paymentIdParamsSchema }),
    asyncHandler(controller.getPaymentDetail)
  );
  router.get(
    "/admin/payments",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ query: adminListPaymentsQuerySchema }),
    asyncHandler(controller.listPaymentsForAdmin)
  );

  return router;
}

export default createPaymentsRouter();

