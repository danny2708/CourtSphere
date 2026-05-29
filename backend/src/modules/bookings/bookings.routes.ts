import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { bookingsController, type BookingsController } from "./bookings.controller";
import {
  bookingOrderIdParamSchema,
  cancelBookingSchema,
  createBookingSchema,
  listMyBookingsQuerySchema
} from "./bookings.validation";

export function createBookingsRouter(
  controller: BookingsController = bookingsController
): Router {
  const router = Router();

  router.use(requireAuth, requireRole(["USER"]));

  router.post(
    "/",
    validateRequest({ body: createBookingSchema }),
    asyncHandler(controller.createBookingHold)
  );
  router.get(
    "/my",
    validateRequest({ query: listMyBookingsQuerySchema }),
    asyncHandler(controller.listMyBookings)
  );
  router.get(
    "/:id",
    validateRequest({ params: bookingOrderIdParamSchema }),
    asyncHandler(controller.getBookingDetail)
  );
  router.post(
    "/:id/cancel",
    validateRequest({ params: bookingOrderIdParamSchema, body: cancelBookingSchema }),
    asyncHandler(controller.cancelMyBooking)
  );

  return router;
}

export default createBookingsRouter();

