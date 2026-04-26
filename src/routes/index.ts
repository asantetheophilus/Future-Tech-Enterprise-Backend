import { Router } from "express";

import { prisma } from "../config/prisma.js";
import { isAuth } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/role.middleware.js";
import { authRouter } from "./auth.routes.js";
import {
  bannerRouter, brandRouter, cartRouter, categoryRouter,
  couponRouter, deliverySettingsRouter, emailTemplatesRouter,
  flashSaleRouter, promoBannerRouter, reviewRouter, settingsRouter,
  whatsappSettingsRouter, wishlistRouter
} from "./cms.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { orderRouter } from "./order.routes.js";
import { paystackRouter } from "./paystack.routes.js";
import { productRouter } from "./product.routes.js";
import { vendorRouter } from "./vendor.routes.js";
import { siteSettingsRouter } from "./site-settings.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/brands", brandRouter);
apiRouter.use("/banners", bannerRouter);
apiRouter.use("/promo-banners", promoBannerRouter);
apiRouter.use("/flash-sales", flashSaleRouter);
apiRouter.use("/coupons", couponRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/wishlist", wishlistRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/delivery-settings", deliverySettingsRouter);
apiRouter.use("/whatsapp-settings", whatsappSettingsRouter);
apiRouter.use("/email-templates", emailTemplatesRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/vendor", vendorRouter);
apiRouter.use("/paystack", paystackRouter);
apiRouter.use("/site-settings", siteSettingsRouter);

// FIXED: password field excluded from customer list response
apiRouter.get("/customers", isAuth, isAdmin, async (_req, res) => {
  const customers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      role: true,
      createdAt: true,
      _count: { select: { orders: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, message: "Customers fetched", data: customers });
});
