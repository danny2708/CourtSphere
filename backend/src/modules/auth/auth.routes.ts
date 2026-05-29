import { Router } from "express";

import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { authController } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest({ body: registerSchema }),
  asyncHandler(authController.register)
);

router.post("/login", validateRequest({ body: loginSchema }), asyncHandler(authController.login));
router.get("/me", requireAuth, asyncHandler(authController.me));
router.post("/logout", requireAuth, asyncHandler(authController.logout));

export default router;
