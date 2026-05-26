import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { managerController, type ManagerController } from "./manager.controller";
import {
  bookingItemIdParamsSchema,
  managerNoShowSchema,
  managerReasonSchema,
  managerTodayScheduleQuerySchema
} from "./manager.validators";

export function createManagerRouter(controller: ManagerController = managerController): Router {
  const router = Router();

  router.use(requireAuth, requireRole(["FIELD_MANAGER", "ADMIN"]));

  router.get(
    "/manager/bookings/today",
    validateRequest({ query: managerTodayScheduleQuerySchema }),
    asyncHandler(controller.getTodaySchedule)
  );
  router.post(
    "/manager/booking-items/:id/check-in",
    validateRequest({ params: bookingItemIdParamsSchema }),
    asyncHandler(controller.checkInBookingItem)
  );
  router.post(
    "/manager/booking-items/:id/override-checkin",
    validateRequest({ params: bookingItemIdParamsSchema, body: managerReasonSchema }),
    asyncHandler(controller.overrideLateCheckin)
  );
  router.post(
    "/manager/booking-items/:id/no-show",
    validateRequest({ params: bookingItemIdParamsSchema, body: managerNoShowSchema }),
    asyncHandler(controller.markNoShow)
  );
  router.post(
    "/manager/booking-items/:id/override-complete",
    validateRequest({ params: bookingItemIdParamsSchema, body: managerReasonSchema }),
    asyncHandler(controller.overrideComplete)
  );

  return router;
}

export default createManagerRouter();
