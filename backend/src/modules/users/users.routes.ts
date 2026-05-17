import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { usersController, type UsersController } from "./users.controller";
import {
  listUsersQuerySchema,
  roleBodySchema,
  updateAccountStatusSchema,
  updateBookingPermissionSchema,
  updatePriorityGroupSchema,
  updateUserProfileSchema,
  userIdParamSchema,
  userRoleParamSchema
} from "./users.validation";

export function createUsersRouter(controller: UsersController = usersController): Router {
  const router = Router();

  router.use(requireAuth, requireRole(["ADMIN"]));

  router.get(
    "/users",
    validateRequest({ query: listUsersQuerySchema }),
    asyncHandler(controller.listUsers)
  );
  router.put(
    "/users/:id",
    validateRequest({ params: userIdParamSchema, body: updateUserProfileSchema }),
    asyncHandler(controller.updateUserProfile)
  );
  router.post(
    "/users/:id/roles",
    validateRequest({ params: userIdParamSchema, body: roleBodySchema }),
    asyncHandler(controller.assignRole)
  );
  router.delete(
    "/users/:id/roles/:roleName",
    validateRequest({ params: userRoleParamSchema }),
    asyncHandler(controller.removeRole)
  );
  router.patch(
    "/users/:id/account-status",
    validateRequest({ params: userIdParamSchema, body: updateAccountStatusSchema }),
    asyncHandler(controller.updateAccountStatus)
  );
  router.patch(
    "/users/:id/booking-permission",
    validateRequest({ params: userIdParamSchema, body: updateBookingPermissionSchema }),
    asyncHandler(controller.updateBookingPermission)
  );
  router.patch(
    "/users/:id/priority-group",
    validateRequest({ params: userIdParamSchema, body: updatePriorityGroupSchema }),
    asyncHandler(controller.updatePriorityGroup)
  );

  return router;
}

export default createUsersRouter();
