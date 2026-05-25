import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import {
  notificationsController,
  type NotificationsController
} from "./notifications.controller";
import {
  listMyNotificationsQuerySchema,
  notificationIdParamSchema
} from "./notifications.validators";

export function createNotificationsRouter(
  controller: NotificationsController = notificationsController
): Router {
  const router = Router();

  router.use(requireAuth);

  router.get(
    "/",
    validateRequest({ query: listMyNotificationsQuerySchema }),
    asyncHandler(controller.listMyNotifications)
  );
  router.get("/unread-count", asyncHandler(controller.getUnreadCount));
  router.patch("/read-all", asyncHandler(controller.markAllAsRead));
  router.patch(
    "/:id/read",
    validateRequest({ params: notificationIdParamSchema }),
    asyncHandler(controller.markAsRead)
  );

  return router;
}

export default createNotificationsRouter();

