import { prisma } from "../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

function appError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `item-${Date.now()}`;
}

async function uniqueCategorySlug(nameOrSlug: string, ignoreId?: string): Promise<string> {
  const base = slugify(nameOrSlug);
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (!existing || existing.id === ignoreId) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

async function uniqueBrandSlug(nameOrSlug: string, ignoreId?: string): Promise<string> {
  const base = slugify(nameOrSlug);
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.brand.findUnique({ where: { slug } });
    if (!existing || existing.id === ignoreId) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

export const cmsService = {
  categories: {
    list: () => prisma.category.findMany({
      include: { children: true, parent: true },
      orderBy: { name: "asc" },
    }),
    create: async (data: any) => {
      if (!data?.name?.trim()) throw new Error("Category name is required");
      const payload = {
        name: data.name.trim(),
        slug: await uniqueCategorySlug(data.slug || data.name),
        image: data.image || null,
        parentId: data.parentId || null
      };
      return prisma.category.create({ data: payload });
    },
    update: async (id: string, data: any) => {
      const payload: any = { ...data };
      if (payload.name) payload.name = payload.name.trim();
      if (payload.slug || payload.name) payload.slug = await uniqueCategorySlug(payload.slug || payload.name, id);
      if (payload.image === "") payload.image = null;
      if (payload.parentId === "") payload.parentId = null;
      return prisma.category.update({ where: { id }, data: payload });
    },
    remove: async (id: string) => {
      const usedByProducts = await prisma.product.count({ where: { categoryId: id } });
      if (usedByProducts > 0) {
        throw appError("This category is assigned to products. Move or delete those products before removing the category.", StatusCodes.CONFLICT);
      }
      const childCategories = await prisma.category.count({ where: { parentId: id } });
      if (childCategories > 0) {
        throw appError("This category has sub-categories. Remove or reassign them before deleting.", StatusCodes.CONFLICT);
      }
      return prisma.category.delete({ where: { id } });
    }
  },
  brands: {
    list: () => prisma.brand.findMany({ orderBy: { name: "asc" } }),
    create: async (data: any) => {
      if (!data?.name?.trim()) throw new Error("Brand name is required");
      const payload = {
        name: data.name.trim(),
        slug: await uniqueBrandSlug(data.slug || data.name),
        logo: data.logo || null
      };
      return prisma.brand.create({ data: payload });
    },
    update: async (id: string, data: any) => {
      const payload: any = { ...data };
      if (payload.name) payload.name = payload.name.trim();
      if (payload.slug || payload.name) payload.slug = await uniqueBrandSlug(payload.slug || payload.name, id);
      if (payload.logo === "") payload.logo = null;
      return prisma.brand.update({ where: { id }, data: payload });
    },
    remove: async (id: string) => {
      const usedByProducts = await prisma.product.count({ where: { brandId: id } });
      if (usedByProducts > 0) {
        throw appError("This brand is assigned to products. Move or delete those products before removing the brand.", StatusCodes.CONFLICT);
      }
      return prisma.brand.delete({ where: { id } });
    }
  },
  banners: {
    list: () => prisma.banner.findMany({ orderBy: { sortOrder: "asc" } }),
    create: (data: any) => prisma.banner.create({ data }),
    update: (id: string, data: any) => prisma.banner.update({ where: { id }, data }),
    remove: (id: string) => prisma.banner.delete({ where: { id } })
  },
  promoBanners: {
    list: () => prisma.promoBanner.findMany(),
    create: (data: any) => prisma.promoBanner.create({ data }),
    update: (id: string, data: any) => prisma.promoBanner.update({ where: { id }, data }),
    remove: (id: string) => prisma.promoBanner.delete({ where: { id } })
  },
  coupons: {
    list: () => prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    create: (data: any) => prisma.coupon.create({ data }),
    update: (id: string, data: any) => prisma.coupon.update({ where: { id }, data }),
    remove: (id: string) => prisma.coupon.delete({ where: { id } }),
    validate: (code: string) => prisma.coupon.findUnique({ where: { code } })
  },
  flashSales: {
    list: () => prisma.flashSale.findMany({ include: { items: true } }),
    create: (data: any) => prisma.flashSale.create({ data }),
    update: (id: string, data: any) => prisma.flashSale.update({ where: { id }, data }),
    remove: (id: string) => prisma.flashSale.delete({ where: { id } })
  },
  cart: {
    get: (userId: string) => prisma.cart.findUnique({ where: { userId } }),
    upsert: (userId: string, items: unknown) =>
      prisma.cart.upsert({
        where: { userId },
        update: { items: items as Prisma.InputJsonValue },
        create: { userId, items: items as Prisma.InputJsonValue }
      }),
    clear: (userId: string) => prisma.cart.deleteMany({ where: { userId } })
  },
  wishlist: {
    list: (userId: string) =>
      prisma.wishlist.findMany({
        where: { userId },
        include: { product: { include: { images: { take: 1 } } } }
      }),
    create: (userId: string, productId: string) => prisma.wishlist.create({ data: { userId, productId } }),
    remove: (userId: string, productId: string) => prisma.wishlist.deleteMany({ where: { userId, productId } })
  },
  reviews: {
    list: (productId?: string) =>
      prisma.review.findMany({
        where: productId ? { productId } : undefined,
        include: { user: { select: { id: true, name: true, avatar: true } }, product: true },
        orderBy: { createdAt: "desc" }
      }),
    create: (data: any) => prisma.review.create({ data }),
    update: (id: string, data: any) => prisma.review.update({ where: { id }, data })
  },
  settings: {
    list: () => prisma.setting.findMany(),
    update: (key: string, value: any) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, group: "general", value }
      })
  }
};
