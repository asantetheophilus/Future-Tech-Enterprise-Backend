import { Router } from "express";

import { dashboardController } from "../controllers/dashboard.controller.js";
import { isAuth } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", isAuth, isAdmin, asyncHandler(dashboardController.stats));
dashboardRouter.get("/health/variants", isAuth, isAdmin, asyncHandler(dashboardController.variantHealth));
