import { Router } from "express";

import { authController } from "../controllers/auth.controller.js";
import { isAuth } from "../middleware/auth.middleware.js";
import { authRateLimit } from "../middleware/rate-limit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  changeEmailSchema, changePasswordSchema,
  forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema
} from "../validations/auth.validation.js";

export const authRouter = Router();

authRouter.post("/register",         authRateLimit, validate(registerSchema),       asyncHandler(authController.register));
authRouter.post("/login",            authRateLimit, validate(loginSchema),          asyncHandler(authController.login));
authRouter.post("/admin/login",      authRateLimit, validate(loginSchema),          asyncHandler(authController.adminLogin));
authRouter.post("/refresh-token",                                                   asyncHandler(authController.refreshToken));
authRouter.post("/logout",                                                          asyncHandler(authController.logout));
authRouter.post("/forgot-password",  authRateLimit, validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
authRouter.post("/reset-password",   authRateLimit, validate(resetPasswordSchema),  asyncHandler(authController.resetPassword));

// ─── Account management (authenticated) ──────────────────────────────────────
authRouter.patch("/change-password", isAuth, validate(changePasswordSchema), asyncHandler(authController.changePassword));
authRouter.patch("/change-email",    isAuth, validate(changeEmailSchema),    asyncHandler(authController.changeEmail));
