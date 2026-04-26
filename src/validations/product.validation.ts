import { z } from "zod";

export const productListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    sort: z.enum(["newest", "price-asc", "price-desc", "top-rated"]).optional()
  })
});

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    slug: z.string().min(2).optional(),
    description: z.string().min(2),
    price: z.coerce.number().nonnegative(),
    comparePrice: z.coerce.number().nonnegative().optional(),
    sku: z.string().min(2),
    stock: z.coerce.number().int().nonnegative(),
    categoryId: z.string().min(2),
    brandId: z.string().min(2),
    isFeatured: z.boolean().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    variations: z
      .array(
        z.object({
          type: z.string().min(2),
          value: z.string().min(1),
          stock: z.number().int().nonnegative(),
          priceModifier: z.number()
        })
      )
      .optional(),
    variants: z
      .array(
        z.object({
          sku: z.string().min(2),
          attributes: z.record(z.string(), z.string()),
          stock: z.number().int().nonnegative(),
          priceModifier: z.number(),
          image: z.string().optional(),
          isDefault: z.boolean().optional()
        })
      )
      .optional()
  })
});
