import { Router } from "express";

import { cmsController } from "../controllers/cms.controller.js";
import { isAuth } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const categoryRouter = Router();
categoryRouter.get("/", asyncHandler(cmsController.categories.list));
categoryRouter.post("/", isAuth, isAdmin, asyncHandler(cmsController.categories.create));
categoryRouter.put("/:id", isAuth, isAdmin, asyncHandler(cmsController.categories.update));
categoryRouter.delete("/:id", isAuth, isAdmin, asyncHandler(cmsController.categories.remove));

export const brandRouter = Router();
brandRouter.get("/", asyncHandler(cmsController.brands.list));
brandRouter.post("/", isAuth, isAdmin, asyncHandler(cmsController.brands.create));
brandRouter.put("/:id", isAuth, isAdmin, asyncHandler(cmsController.brands.update));
brandRouter.delete("/:id", isAuth, isAdmin, asyncHandler(cmsController.brands.remove));

export const bannerRouter = Router();
bannerRouter.get("/", asyncHandler(cmsController.banners.list));
bannerRouter.post("/", isAuth, isAdmin, asyncHandler(cmsController.banners.create));
bannerRouter.put("/:id", isAuth, isAdmin, asyncHandler(cmsController.banners.update));
bannerRouter.delete("/:id", isAuth, isAdmin, asyncHandler(cmsController.banners.remove));

export const promoBannerRouter = Router();
promoBannerRouter.get("/", asyncHandler(cmsController.promoBanners.list));
promoBannerRouter.post("/", isAuth, isAdmin, asyncHandler(cmsController.promoBanners.create));
promoBannerRouter.put("/:id", isAuth, isAdmin, asyncHandler(cmsController.promoBanners.update));
promoBannerRouter.delete("/:id", isAuth, isAdmin, asyncHandler(cmsController.promoBanners.remove));

export const flashSaleRouter = Router();
flashSaleRouter.get("/", asyncHandler(cmsController.flashSales.list));
flashSaleRouter.post("/", isAuth, isAdmin, asyncHandler(cmsController.flashSales.create));
flashSaleRouter.put("/:id", isAuth, isAdmin, asyncHandler(cmsController.flashSales.update));
flashSaleRouter.delete("/:id", isAuth, isAdmin, asyncHandler(cmsController.flashSales.remove));

export const couponRouter = Router();
couponRouter.get("/", isAuth, isAdmin, asyncHandler(cmsController.coupons.list));
couponRouter.post("/", isAuth, isAdmin, asyncHandler(cmsController.coupons.create));
couponRouter.put("/:id", isAuth, isAdmin, asyncHandler(cmsController.coupons.update));
couponRouter.delete("/:id", isAuth, isAdmin, asyncHandler(cmsController.coupons.remove));
couponRouter.post("/validate", asyncHandler(cmsController.coupons.validate));

export const cartRouter = Router();
cartRouter.get("/", isAuth, asyncHandler(cmsController.cart.get));
cartRouter.post("/", isAuth, asyncHandler(cmsController.cart.upsert));
cartRouter.delete("/", isAuth, asyncHandler(cmsController.cart.remove));

export const wishlistRouter = Router();
wishlistRouter.get("/", isAuth, asyncHandler(cmsController.wishlist.list));
wishlistRouter.post("/", isAuth, asyncHandler(cmsController.wishlist.create));
wishlistRouter.delete("/:productId", isAuth, asyncHandler(cmsController.wishlist.remove));

export const reviewRouter = Router();
reviewRouter.get("/", asyncHandler(cmsController.reviews.list));
reviewRouter.post("/", isAuth, asyncHandler(cmsController.reviews.create));
reviewRouter.put("/:id", isAuth, isAdmin, asyncHandler(cmsController.reviews.update));

export const settingsRouter = Router();
settingsRouter.get("/", asyncHandler(cmsController.settings.list));
settingsRouter.put("/", isAuth, isAdmin, asyncHandler(cmsController.settings.update));

export const deliverySettingsRouter = Router();
deliverySettingsRouter.get("/", asyncHandler(cmsController.deliverySettings.get));
deliverySettingsRouter.put("/", isAuth, isAdmin, asyncHandler(cmsController.deliverySettings.update));

export const whatsappSettingsRouter = Router();
whatsappSettingsRouter.get("/", isAuth, isAdmin, asyncHandler(cmsController.whatsappSettings.get));
whatsappSettingsRouter.put("/", isAuth, isAdmin, asyncHandler(cmsController.whatsappSettings.update));

export const emailTemplatesRouter = Router();
emailTemplatesRouter.get("/", isAuth, isAdmin, asyncHandler(cmsController.emailTemplates.get));
emailTemplatesRouter.put("/:id", isAuth, isAdmin, asyncHandler(cmsController.emailTemplates.update));
