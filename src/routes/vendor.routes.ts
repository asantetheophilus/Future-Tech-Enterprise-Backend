import { Router } from "express";

import { vendorController } from "../controllers/vendor.controller.js";
import { isAuth } from "../middleware/auth.middleware.js";
import { isVendor } from "../middleware/role.middleware.js";

export const vendorRouter = Router();

vendorRouter.use(isAuth, isVendor);
vendorRouter.get("/dashboard", vendorController.notImplemented);
vendorRouter.get("/orders", vendorController.notImplemented);
vendorRouter.get("/products", vendorController.notImplemented);
