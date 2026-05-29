import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { reportsController, type ReportsController } from "./reports.controller";
import {
  groupedReportsQuerySchema,
  reportsDateRangeQuerySchema,
  violatingUsersReportQuerySchema
} from "./reports.validators";

export function createReportsRouter(
  controller: ReportsController = reportsController
): Router {
  const router = Router();

  router.get(
    "/reports/overview",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ query: reportsDateRangeQuerySchema }),
    asyncHandler(controller.getOverview)
  );
  router.get(
    "/reports/bookings",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ query: groupedReportsQuerySchema }),
    asyncHandler(controller.getBookingReport)
  );
  router.get(
    "/reports/revenue",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ query: groupedReportsQuerySchema }),
    asyncHandler(controller.getRevenueReport)
  );
  router.get(
    "/reports/courts/usage",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ query: reportsDateRangeQuerySchema }),
    asyncHandler(controller.getCourtUsageReport)
  );
  router.get(
    "/reports/rates",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ query: reportsDateRangeQuerySchema }),
    asyncHandler(controller.getRatesReport)
  );
  router.get(
    "/reports/violations",
    requireAuth,
    requireRole(["ADMIN"]),
    validateRequest({ query: violatingUsersReportQuerySchema }),
    asyncHandler(controller.getViolatingUsersReport)
  );

  return router;
}

export default createReportsRouter();
