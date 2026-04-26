import { Router } from "express";

import { upload } from "../config/cloudinary.js";
import { productController } from "../controllers/product.controller.js";
import { isAuth } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createProductSchema, productListSchema } from "../validations/product.validation.js";
import { asyncHandler } from "../utils/async-handler.js";

export const productRouter = Router();

productRouter.get("/", validate(productListSchema), asyncHandler(productController.list));
productRouter.get("/admin/all", isAuth, isAdmin, validate(productListSchema), asyncHandler(productController.adminList));
productRouter.get("/featured", asyncHandler(productController.featured));
productRouter.get("/flash-sale", asyncHandler(productController.flashSale));
productRouter.get("/:slug", asyncHandler(productController.detail));

productRouter.post("/", isAuth, isAdmin, validate(createProductSchema), asyncHandler(productController.create));
productRouter.put("/:id", isAuth, isAdmin, asyncHandler(productController.update));
productRouter.delete("/:id", isAuth, isAdmin, asyncHandler(productController.remove));
productRouter.post(
  "/:id/images",
  isAuth,
  isAdmin,
  upload.array("images", 8),
  asyncHandler(productController.uploadImages)
);
productRouter.patch("/:id/images/reorder", isAuth, isAdmin, asyncHandler(productController.reorderImages));
productRouter.patch("/:id/images/:imgId/feature", isAuth, isAdmin, asyncHandler(productController.featureImage));
productRouter.delete("/:id/images/:imgId", isAuth, isAdmin, asyncHandler(productController.deleteImage));
