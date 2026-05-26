import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { waitlistController, type WaitlistController } from "./waitlist.controller";
import {
  joinWaitlistSchema,
  listMyWaitlistQuerySchema,
  waitlistEntryIdParamSchema
} from "./waitlist.validators";

export function createWaitlistRouter(
  controller: WaitlistController = waitlistController
): Router {
  const router = Router();

  router.use(requireAuth, requireRole(["USER"]));

  router.post(
    "/",
    validateRequest({ body: joinWaitlistSchema }),
    asyncHandler(controller.joinWaitlist)
  );
  router.get(
    "/my",
    validateRequest({ query: listMyWaitlistQuerySchema }),
    asyncHandler(controller.getMyWaitlist)
  );
  router.delete(
    "/:id",
    validateRequest({ params: waitlistEntryIdParamSchema }),
    asyncHandler(controller.cancelWaitlist)
  );
  router.post(
    "/:id/book",
    validateRequest({ params: waitlistEntryIdParamSchema }),
    asyncHandler(controller.bookFromWaitlist)
  );

  return router;
}

export default createWaitlistRouter();
