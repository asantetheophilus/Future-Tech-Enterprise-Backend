import { Prisma } from "@prisma/client";

import { prisma } from "../src/config/prisma.js";

async function migrateOrderItems() {
  const dbName = process.env.DATABASE_URL?.match(/\/([^/?]+)(\?|$)/)?.[1];
  if (!dbName) {
    return { skipped: true, reason: "DATABASE_URL database name not detected" };
  }

  const columnCheck = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'order_items'
       AND COLUMN_NAME = 'variationId'`,
    dbName
  );

  const hasVariationColumn = Number(columnCheck[0]?.count ?? 0) > 0;
  if (!hasVariationColumn) {
    return {
      skipped: true,
      reason: "order_items.variationId column no longer exists (already cut over)"
    };
  }

  const updateResult = await prisma.$executeRawUnsafe(`
    UPDATE order_items oi
    JOIN product_variants pv ON pv.legacyVariationId = oi.variationId
    SET oi.variantId = pv.id
    WHERE oi.variantId IS NULL
      AND oi.variationId IS NOT NULL
  `);

  return { skipped: false, migratedRows: Number(updateResult) };
}

async function migrateCarts() {
  const variants = await prisma.productVariant.findMany({
    where: { legacyVariationId: { not: null } },
    select: { id: true, legacyVariationId: true }
  });
  const variationToVariant = new Map(
    variants.filter((v) => v.legacyVariationId).map((v) => [v.legacyVariationId!, v.id])
  );

  const carts = await prisma.cart.findMany({ select: { id: true, items: true } });
  let updatedCarts = 0;

  for (const cart of carts) {
    if (!Array.isArray(cart.items)) continue;
    let touched = false;

    const nextItems = cart.items.map((rawItem) => {
      if (!rawItem || typeof rawItem !== "object") return rawItem;
      const item = { ...(rawItem as Record<string, unknown>) };
      const legacyVariationId =
        typeof item.variationId === "string" ? item.variationId : undefined;
      const currentVariantId = typeof item.variantId === "string" ? item.variantId : undefined;

      if (!currentVariantId && legacyVariationId) {
        const mappedVariant = variationToVariant.get(legacyVariationId);
        if (mappedVariant) {
          item.variantId = mappedVariant;
          touched = true;
        }
      }

      if ("variationId" in item) {
        delete item.variationId;
        touched = true;
      }

      return item;
    });

    if (!touched) continue;

    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        items: nextItems as Prisma.InputJsonValue
      }
    });
    updatedCarts += 1;
  }

  return { totalCarts: carts.length, updatedCarts };
}

async function main() {
  const orderItemSummary = await migrateOrderItems();
  const cartSummary = await migrateCarts();

  console.log("Legacy variation migration completed.");
  console.log({
    orderItems: orderItemSummary,
    carts: cartSummary
  });
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
