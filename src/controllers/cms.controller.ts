import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import { cmsService } from "../services/cms.service.js";
import { sendResponse } from "../utils/response.js";

export const cmsController = {
  categories: {
    list: async (_req: Request, res: Response) => {
      const data = await cmsService.categories.list();
      return sendResponse(res, { message: "Categories fetched", data });
    },
    create: async (req: Request, res: Response) => {
      const data = await cmsService.categories.create(req.body);
      return sendResponse(res, { statusCode: StatusCodes.CREATED, message: "Category created", data });
    },
    update: async (req: Request, res: Response) => {
      const data = await cmsService.categories.update(req.params.id, req.body);
      return sendResponse(res, { message: "Category updated", data });
    },
    remove: async (req: Request, res: Response) => {
      await cmsService.categories.remove(req.params.id);
      return sendResponse(res, { message: "Category deleted", data: null });
    }
  },
  brands: {
    list: async (_req: Request, res: Response) => sendResponse(res, { message: "Brands fetched", data: await cmsService.brands.list() }),
    create: async (req: Request, res: Response) => sendResponse(res, { statusCode: StatusCodes.CREATED, message: "Brand created", data: await cmsService.brands.create(req.body) }),
    update: async (req: Request, res: Response) => sendResponse(res, { message: "Brand updated", data: await cmsService.brands.update(req.params.id, req.body) }),
    remove: async (req: Request, res: Response) => {
      await cmsService.brands.remove(req.params.id);
      return sendResponse(res, { message: "Brand deleted", data: null });
    }
  },
  banners: {
    list: async (_req: Request, res: Response) => sendResponse(res, { message: "Banners fetched", data: await cmsService.banners.list() }),
    create: async (req: Request, res: Response) => sendResponse(res, { statusCode: StatusCodes.CREATED, message: "Banner created", data: await cmsService.banners.create(req.body) }),
    update: async (req: Request, res: Response) => sendResponse(res, { message: "Banner updated", data: await cmsService.banners.update(req.params.id, req.body) }),
    remove: async (req: Request, res: Response) => {
      await cmsService.banners.remove(req.params.id);
      return sendResponse(res, { message: "Banner deleted", data: null });
    }
  },
  promoBanners: {
    list: async (_req: Request, res: Response) => sendResponse(res, { message: "Promo banners fetched", data: await cmsService.promoBanners.list() }),
    create: async (req: Request, res: Response) => sendResponse(res, { statusCode: StatusCodes.CREATED, message: "Promo banner created", data: await cmsService.promoBanners.create(req.body) }),
    update: async (req: Request, res: Response) => sendResponse(res, { message: "Promo banner updated", data: await cmsService.promoBanners.update(req.params.id, req.body) }),
    remove: async (req: Request, res: Response) => {
      await cmsService.promoBanners.remove(req.params.id);
      return sendResponse(res, { message: "Promo banner deleted", data: null });
    }
  },
  flashSales: {
    list: async (_req: Request, res: Response) => sendResponse(res, { message: "Flash sales fetched", data: await cmsService.flashSales.list() }),
    create: async (req: Request, res: Response) => sendResponse(res, { statusCode: StatusCodes.CREATED, message: "Flash sale created", data: await cmsService.flashSales.create(req.body) }),
    update: async (req: Request, res: Response) => sendResponse(res, { message: "Flash sale updated", data: await cmsService.flashSales.update(req.params.id, req.body) }),
    remove: async (req: Request, res: Response) => {
      await cmsService.flashSales.remove(req.params.id);
      return sendResponse(res, { message: "Flash sale deleted", data: null });
    }
  },
  coupons: {
    list: async (_req: Request, res: Response) => sendResponse(res, { message: "Coupons fetched", data: await cmsService.coupons.list() }),
    create: async (req: Request, res: Response) => sendResponse(res, { statusCode: StatusCodes.CREATED, message: "Coupon created", data: await cmsService.coupons.create(req.body) }),
    update: async (req: Request, res: Response) => sendResponse(res, { message: "Coupon updated", data: await cmsService.coupons.update(req.params.id, req.body) }),
    remove: async (req: Request, res: Response) => {
      await cmsService.coupons.remove(req.params.id);
      return sendResponse(res, { message: "Coupon deleted", data: null });
    },
    validate: async (req: Request, res: Response) => {
      const coupon = await cmsService.coupons.validate(req.body.code);
      const valid = Boolean(coupon?.isActive && (!coupon.expiresAt || coupon.expiresAt > new Date()));
      return sendResponse(res, { message: valid ? "Coupon valid" : "Coupon invalid", data: coupon ?? null });
    }
  },
  cart: {
    get: async (req: Request, res: Response) => sendResponse(res, { message: "Cart fetched", data: await cmsService.cart.get(req.user!.id) }),
    upsert: async (req: Request, res: Response) =>
      sendResponse(res, { message: "Cart updated", data: await cmsService.cart.upsert(req.user!.id, req.body.items) }),
    remove: async (req: Request, res: Response) => {
      await cmsService.cart.clear(req.user!.id);
      return sendResponse(res, { message: "Cart cleared", data: null });
    }
  },
  wishlist: {
    list: async (req: Request, res: Response) => sendResponse(res, { message: "Wishlist fetched", data: await cmsService.wishlist.list(req.user!.id) }),
    create: async (req: Request, res: Response) =>
      sendResponse(res, { statusCode: StatusCodes.CREATED, message: "Wishlist item added", data: await cmsService.wishlist.create(req.user!.id, req.body.productId) }),
    remove: async (req: Request, res: Response) => {
      await cmsService.wishlist.remove(req.user!.id, req.params.productId);
      return sendResponse(res, { message: "Wishlist item removed", data: null });
    }
  },
  reviews: {
    list: async (req: Request, res: Response) => sendResponse(res, { message: "Reviews fetched", data: await cmsService.reviews.list(req.query.productId as string | undefined) }),
    create: async (req: Request, res: Response) =>
      sendResponse(res, { statusCode: StatusCodes.CREATED, message: "Review created", data: await cmsService.reviews.create({ ...req.body, userId: req.user!.id }) }),
    update: async (req: Request, res: Response) =>
      sendResponse(res, { message: "Review updated", data: await cmsService.reviews.update(req.params.id, req.body) })
  },
  settings: {
    list: async (_req: Request, res: Response) => sendResponse(res, { message: "Settings fetched", data: await cmsService.settings.list() }),
    update: async (req: Request, res: Response) =>
      sendResponse(res, { message: "Setting updated", data: await cmsService.settings.update(req.body.key, req.body.value) })
  },
  deliverySettings: {
    get: async (_req: Request, res: Response) =>
      sendResponse(res, { message: "Delivery settings fetched", data: await prisma.deliverySetting.findFirst() }),
    update: async (req: Request, res: Response) => {
      const current = await prisma.deliverySetting.findFirst();
      const data = current
        ? await prisma.deliverySetting.update({ where: { id: current.id }, data: req.body })
        : await prisma.deliverySetting.create({ data: req.body });
      return sendResponse(res, { message: "Delivery settings updated", data });
    }
  },
  whatsappSettings: {
    get: async (_req: Request, res: Response) =>
      sendResponse(res, { message: "WhatsApp settings fetched", data: await prisma.whatsappSetting.findFirst() }),
    update: async (req: Request, res: Response) => {
      const current = await prisma.whatsappSetting.findFirst();
      const data = current
        ? await prisma.whatsappSetting.update({ where: { id: current.id }, data: req.body })
        : await prisma.whatsappSetting.create({ data: req.body });
      return sendResponse(res, { message: "WhatsApp settings updated", data });
    }
  },
  emailTemplates: {
    get: async (_req: Request, res: Response) =>
      sendResponse(res, { message: "Email templates fetched", data: await prisma.emailTemplate.findMany() }),
    update: async (req: Request, res: Response) =>
      sendResponse(res, {
        message: "Email template updated",
        data: await prisma.emailTemplate.update({ where: { id: req.params.id }, data: req.body })
      })
  }
};
