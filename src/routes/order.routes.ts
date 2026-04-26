import { Router } from "express";

import { orderController } from "../controllers/order.controller.js";
import { isAuth } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createGuestOrderSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  updatePaymentStatusSchema
} from "../validations/order.validation.js";
import { asyncHandler } from "../utils/async-handler.js";

export const orderRouter = Router();

orderRouter.post("/", isAuth, validate(createOrderSchema), asyncHandler(orderController.create));
orderRouter.post("/guest", validate(createGuestOrderSchema), asyncHandler(orderController.createGuest));
orderRouter.get("/", isAuth, asyncHandler(orderController.customerOrders));
orderRouter.get("/admin/all", isAuth, isAdmin, asyncHandler(orderController.adminOrders));
orderRouter.put("/:id/status", isAuth, isAdmin, validate(updateOrderStatusSchema), asyncHandler(orderController.updateStatus));
orderRouter.put("/:id/payment", isAuth, isAdmin, validate(updatePaymentStatusSchema), asyncHandler(orderController.updatePayment));
orderRouter.get("/:id/invoice", isAuth, asyncHandler(orderController.invoice));
orderRouter.get("/:id", isAuth, asyncHandler(orderController.detail));
