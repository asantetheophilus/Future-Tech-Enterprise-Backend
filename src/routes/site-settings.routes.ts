import { Router } from "express";
import { siteSettingsController } from "../controllers/site-settings.controller.js";
import { isAuth } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const siteSettingsRouter = Router();

// Public – frontend reads these to populate site
siteSettingsRouter.get("/", asyncHandler(siteSettingsController.getAll));
siteSettingsRouter.get("/:key", asyncHandler(siteSettingsController.getOne));

// Admin – write
siteSettingsRouter.put("/bulk", isAuth, isAdmin, asyncHandler(siteSettingsController.updateBulk));
siteSettingsRouter.put("/:key", isAuth, isAdmin, asyncHandler(siteSettingsController.update));
