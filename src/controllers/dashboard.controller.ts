import type { Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import { sendResponse } from "../utils/response.js";

export const dashboardController = {
  async stats(_req: Request, res: Response) {
    const [totalProducts, totalOrders, totalUsers, lowStock, recentOrders, paidRevenue] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count(),
      prisma.product.findMany({
        where: { stock: { lt: 10 } },
        take: 10,
        orderBy: { stock: "asc" },
        include: { category: true, brand: true, images: { take: 1, orderBy: { sortOrder: "asc" } } }
      }),
      prisma.order.findMany({
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        take: 10,
        orderBy: { createdAt: "desc" }
      }),
      prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: "PAID" } })
    ]);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const paidOrders = await prisma.order.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: since } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    });

    const dailySales = new Map<string, number>();
    for (const order of paidOrders) {
      const day = order.createdAt.toISOString().slice(0, 10);
      dailySales.set(day, (dailySales.get(day) ?? 0) + Number(order.total));
    }

    return sendResponse(res, {
      message: "Dashboard stats fetched",
      data: {
        totals: {
          products: totalProducts,
          orders: totalOrders,
          users: totalUsers,
          revenue: Number(paidRevenue._sum.total ?? 0)
        },
        lowStock,
        recentOrders,
        sales30Days: Array.from(dailySales.entries()).map(([date, total]) => ({ date, total }))
      }
    });
  },

  async variantHealth(req: Request, res: Response) {
    const windowDays = Number(req.query.days ?? 30);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [allItemsCount, allMissingCount, windowItemsCount, windowMissingCount, sampleMissing] =
      await Promise.all([
        prisma.orderItem.count(),
        prisma.orderItem.count({ where: { variantId: null } }),
        prisma.orderItem.count({ where: { createdAt: { gte: since } } }),
        prisma.orderItem.count({ where: { createdAt: { gte: since }, variantId: null } }),
        prisma.orderItem.findMany({
          where: { variantId: null },
          include: { order: true, product: true },
          orderBy: { createdAt: "desc" },
          take: 10
        })
      ]);

    const allCoverage =
      allItemsCount === 0 ? 100 : Number((((allItemsCount - allMissingCount) / allItemsCount) * 100).toFixed(2));
    const windowCoverage =
      windowItemsCount === 0
        ? 100
        : Number((((windowItemsCount - windowMissingCount) / windowItemsCount) * 100).toFixed(2));

    return sendResponse(res, {
      message: "Variant integrity health fetched",
      data: {
        windowDays,
        allTime: {
          totalItems: allItemsCount,
          missingVariantId: allMissingCount,
          coveragePercent: allCoverage
        },
        recentWindow: {
          totalItems: windowItemsCount,
          missingVariantId: windowMissingCount,
          coveragePercent: windowCoverage
        },
        healthy: allMissingCount === 0 && windowMissingCount === 0,
        sampleMissing: sampleMissing.map((item) => ({
          orderId: item.orderId,
          orderStatus: item.order.status,
          productName: item.product.name,
          createdAt: item.createdAt
        }))
      }
    });
  }
};
