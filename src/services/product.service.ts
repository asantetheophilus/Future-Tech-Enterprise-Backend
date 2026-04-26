import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { cloudinary, hasCloudinary, UPLOADS_DIR } from "../config/cloudinary.js";

function appError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

type NormalizedVariant = {
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  priceModifier: number;
  image?: string;
  isDefault?: boolean;
  legacyType: string;
  legacyValue: string;
};

function slugifyPart(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uniqueProductSlug(nameOrSlug: string, ignoreId?: string): Promise<string> {
  const base = slugifyPart(nameOrSlug) || "product-" + Date.now();
  let slug = base;
  let counter = 1;
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (!existing || existing.id === ignoreId) return slug;
    counter += 1;
    slug = base + "-" + counter;
  }
}

function parseLegacyComboValue(value: string) {
  const attributes: Record<string, string> = {};
  value.split(";").map(p => p.trim()).filter(Boolean).forEach(pair => {
    const [rawKey, ...rest] = pair.split("=");
    const key = rawKey?.trim();
    const val = rest.join("=").trim();
    if (key && val) attributes[key] = val;
  });
  return attributes;
}

function encodeLegacyComboValue(attributes: Record<string, string>) {
  return Object.entries(attributes).map(([k, v]) => `${k}=${v}`).join(";");
}

function normalizeVariants(payload: any): NormalizedVariant[] | null {
  if (Array.isArray(payload?.variants)) {
    return payload.variants.map((v: any, i: number) => ({
      sku: v.sku,
      attributes: v.attributes ?? {},
      stock: Number(v.stock ?? 0),
      priceModifier: Number(v.priceModifier ?? 0),
      image: v.image,
      isDefault: Boolean(v.isDefault),
      legacyType: "COMBO",
      legacyValue: encodeLegacyComboValue(v.attributes ?? {}) || `Option=${i + 1}`
    }));
  }
  if (Array.isArray(payload?.variations)) {
    return payload.variations.map((v: any, i: number) => {
      const attributes = v.type === "COMBO"
        ? parseLegacyComboValue(String(v.value ?? ""))
        : { [String(v.type ?? "Option")]: String(v.value ?? "") };
      const skuSuffix = Object.values(attributes).map(slugifyPart).filter(Boolean).join("-") || `${i + 1}`;
      return {
        sku: `${payload.sku}-${skuSuffix}-${i + 1}`,
        attributes,
        stock: Number(v.stock ?? 0),
        priceModifier: Number(v.priceModifier ?? 0),
        isDefault: i === 0,
        legacyType: v.type,
        legacyValue: v.value
      };
    });
  }
  return null;
}

export const productService = {
  async list(query: Record<string, unknown>, options?: { includeInactive?: boolean }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;
    const search = String(query.search ?? "");
    const category = String(query.category ?? "");
    const brand = String(query.brand ?? "");
    const sort = String(query.sort ?? "newest");

    const where: Prisma.ProductWhereInput = {
      ...(options?.includeInactive ? {} : { status: "ACTIVE" }),
      ...(search ? {
        OR: [
          { name: { contains: search } } as Prisma.ProductWhereInput,
          { description: { contains: search } } as Prisma.ProductWhereInput,
        ]
      } : {}),
      ...(category ? { category: { slug: category } } : {}),
      ...(brand ? { brand: { slug: brand } } : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === "price-asc" ? { price: "asc" }
      : sort === "price-desc" ? { price: "desc" }
      : { createdAt: "desc" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, orderBy, skip, take: limit,
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          brand: true,
          category: true,
          // FIXED: only count reviews for list; don't fetch full records
          _count: { select: { reviews: { where: { status: "APPROVED" } } } },
          reviews: { where: { status: "APPROVED" }, select: { rating: true } }
        }
      }),
      prisma.product.count({ where })
    ]);

    return {
      data: products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  },

  async detail(slug: string) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variations: true,
        productVariants: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        brand: true,
        category: true,
        reviews: { include: { user: { select: { id:true, name:true, avatar:true } } }, where: { status: "APPROVED" }, orderBy: { createdAt: "desc" } }
      }
    });
    // FIXED: return 404 instead of null with 200
    if (!product) {
      throw appError("Product not found", StatusCodes.NOT_FOUND);
    }
    return product;
  },

  featured() {
    return prisma.product.findMany({
      where: { isFeatured: true, status: "ACTIVE" },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        brand: true,
        category: true,
        reviews: { where: { status: "APPROVED" }, select: { rating: true } }
      }
    });
  },

  async flashSale() {
    const now = new Date();
    return prisma.flashSale.findFirst({
      where: { isActive: true, startTime: { lte: now }, endTime: { gte: now } },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { take: 1 },
                brand: true,
                category: true,
                reviews: { where: { status: "APPROVED" }, select: { rating: true } }
              }
            }
          }
        }
      }
    });
  },

  async create(payload: any) {
    const normalizedVariants = normalizeVariants(payload);
    const { variations, variants, ...productData } = payload;
    productData.slug = await uniqueProductSlug(productData.slug || productData.name);

    return prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: productData });

      if (normalizedVariants?.length) {
        for (const v of normalizedVariants) {
          const legacy = await tx.productVariation.create({
            data: { productId: created.id, type: v.legacyType, value: v.legacyValue, stock: v.stock, priceModifier: v.priceModifier }
          });
          await tx.productVariant.create({
            data: { productId: created.id, legacyVariationId: legacy.id, sku: v.sku, attributes: v.attributes, stock: v.stock, priceModifier: v.priceModifier, image: v.image, isDefault: v.isDefault }
          });
        }
      }
      return created;
    });
  },

  async update(id: string, payload: any) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw appError("Product not found", StatusCodes.NOT_FOUND);

    const { variations, variants, ...rest } = payload;
    if (rest.slug || rest.name) rest.slug = await uniqueProductSlug(rest.slug || rest.name, id);
    const normalizedVariants = normalizeVariants(payload);
    const hasVariantPayload = Array.isArray(variations) || Array.isArray(variants);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: rest });

      if (hasVariantPayload) {
        await tx.productVariant.deleteMany({ where: { productId: id } });
        await tx.productVariation.deleteMany({ where: { productId: id } });

        if (normalizedVariants?.length) {
          for (const v of normalizedVariants) {
            const legacy = await tx.productVariation.create({
              data: { productId: id, type: v.legacyType, value: v.legacyValue, stock: v.stock, priceModifier: v.priceModifier }
            });
            await tx.productVariant.create({
              data: { productId: id, legacyVariationId: legacy.id, sku: v.sku, attributes: v.attributes, stock: v.stock, priceModifier: v.priceModifier, image: v.image, isDefault: v.isDefault }
            });
          }
        }
      }
      return updated;
    });
  },

  async remove(id: string) {
    const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!product) throw appError("Product not found", StatusCodes.NOT_FOUND);

    // Delete Cloudinary images if configured (non-blocking — don't fail the delete if this errors)
    if (hasCloudinary) {
      await Promise.allSettled(product.images.map(img => cloudinary.uploader.destroy(img.publicId)));
    } else {
      // Local disk — delete files
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      await Promise.allSettled(
        product.images.map(img =>
          fs.unlink(path.join(UPLOADS_DIR, path.basename(img.url))).catch(() => {})
        )
      );
    }
    await prisma.product.delete({ where: { id } });
  }
};
