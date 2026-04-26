import crypto from "node:crypto";

import { CouponType, Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { sendTemplateEmail } from "../utils/email.js";
import { generateInvoicePdf } from "../utils/invoice.js";
import { hashPassword } from "../utils/password.js";
import { buildWhatsAppLink } from "../utils/whatsapp.js";

function appError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

type CreateOrderPayload = {
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  address: { fullName: string; phone: string; city: string; street: string; country: string };
  paymentMethod: string;
  notes?: string;
  couponCode?: string;
};

type ResolvedCartItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

async function createOrderInternal(userId: string, payload: CreateOrderPayload) {
  // Validate customer user before attempting tx.order.create. This prevents ugly
  // Prisma foreign-key errors when an admin/staff token is accidentally used.
  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }
  });
  if (!customer) {
    throw appError("Order could not be placed because the session is not a valid customer account. Please sign in as a customer or continue as guest.", StatusCodes.UNAUTHORIZED);
  }

  const productIds = payload.items.map(i => i.productId);
  const requestedVariantIds = payload.items.map(i => i.variantId).filter((v): v is string => Boolean(v));

  const [products, variants, legacyVariations, delivery] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } }),
    requestedVariantIds.length
      ? prisma.productVariant.findMany({
          where: {
            OR: [
              { id: { in: requestedVariantIds } },
              { legacyVariationId: { in: requestedVariantIds } }
            ]
          }
        })
      : Promise.resolve([]),
    requestedVariantIds.length
      ? prisma.productVariation.findMany({ where: { id: { in: requestedVariantIds } } })
      : Promise.resolve([]),
    prisma.deliverySetting.findFirst()
  ]);

  const productMap = new Map(products.map(p => [p.id, p]));
  const variantById = new Map(variants.map(v => [v.id, v]));
  const variantByLegacyId = new Map(variants.filter(v => v.legacyVariationId).map(v => [v.legacyVariationId!, v]));
  const legacyVariationMap = new Map(legacyVariations.map(v => [v.id, v]));

  let subtotal = 0;
  const lineItems: Prisma.OrderItemCreateManyOrderInput[] = [];
  const resolvedItems: ResolvedCartItem[] = [];

  for (const item of payload.items) {
    const product = productMap.get(item.productId);
    if (!product) throw appError(`Product not found: ${item.productId}`, StatusCodes.NOT_FOUND);
    if (product.stock < item.quantity) throw appError(`Insufficient stock for ${product.name}`, StatusCodes.BAD_REQUEST);

    let finalPrice = Number(product.price);
    let canonicalVariantId: string | null = null;
    const variant = item.variantId
      ? (variantById.get(item.variantId) ?? variantByLegacyId.get(item.variantId) ?? null)
      : null;
    const legacyVariation = item.variantId ? legacyVariationMap.get(item.variantId) ?? null : null;

    if (item.variantId) {
      if (variant) {
        if (variant.productId !== product.id) throw appError("Selected variant does not belong to this product", StatusCodes.BAD_REQUEST);
        if (variant.stock < item.quantity) throw appError("Insufficient stock for selected variant", StatusCodes.BAD_REQUEST);
        finalPrice += Number(variant.priceModifier);
        canonicalVariantId = variant.id;
      } else if (legacyVariation) {
        // Backward compatibility for carts created before ProductVariant existed.
        if (legacyVariation.productId !== product.id) throw appError("Selected variation does not belong to this product", StatusCodes.BAD_REQUEST);
        if (legacyVariation.stock < item.quantity) throw appError("Insufficient stock for selected variation", StatusCodes.BAD_REQUEST);
        finalPrice += Number(legacyVariation.priceModifier);
        canonicalVariantId = null; // OrderItem.variantId points only to ProductVariant, so do not save legacy ID here.
      } else {
        throw appError("Selected product option is no longer available. Please remove the item from cart and add it again.", StatusCodes.BAD_REQUEST);
      }
    }

    const lineSubtotal = finalPrice * item.quantity;
    subtotal += lineSubtotal;
    resolvedItems.push({ productId: product.id, variantId: canonicalVariantId, quantity: item.quantity });
    lineItems.push({
      productId: product.id,
      variantId: canonicalVariantId,
      name: product.name,
      image: product.images[0]?.url ?? null,
      price: finalPrice,
      quantity: item.quantity,
      subtotal: lineSubtotal
    });
  }

  const deliveryFee = delivery?.flatFee ? Number(delivery.flatFee) : 0;

  let discount = 0;
  let couponId: string | null = null;
  if (payload.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: payload.couponCode } });
    if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date())) {
      throw appError("Invalid or expired coupon", StatusCodes.BAD_REQUEST);
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw appError("Coupon usage limit reached", StatusCodes.BAD_REQUEST);
    }
    if (coupon.minOrder && subtotal < Number(coupon.minOrder)) {
      throw appError(`Minimum order of ${coupon.minOrder} required for this coupon`, StatusCodes.BAD_REQUEST);
    }
    discount = coupon.type === CouponType.PERCENTAGE
      ? (subtotal * Number(coupon.value)) / 100
      : Number(coupon.value);
    couponId = coupon.id;
  }

  const total = Math.max(subtotal + deliveryFee - discount, 0);

  const order = await prisma.$transaction(async (tx) => {
    // Atomic stock checks first. updateMany with a condition avoids negative stock
    // and gives cleaner errors than decrementing then discovering a failure.
    for (const item of payload.items) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } }
      });
      if (updated.count !== 1) throw appError("One or more products are out of stock. Please refresh your cart.", StatusCodes.CONFLICT);
    }

    for (const item of resolvedItems) {
      if (!item.variantId) continue;
      const updated = await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } }
      });
      if (updated.count !== 1) throw appError("Selected product option is out of stock. Please refresh your cart.", StatusCodes.CONFLICT);
    }

    const created = await tx.order.create({
      data: {
        userId,
        paymentMethod: payload.paymentMethod,
        paymentStatus: payload.paymentMethod.toLowerCase().includes("paystack") ? "UNPAID" : "UNPAID",
        subtotal, deliveryFee, discount, total,
        address: payload.address,
        notes: payload.notes,
        items: { createMany: { data: lineItems } }
      }
    });
    if (couponId) {
      await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
      await tx.couponUse.create({ data: { couponId, userId, orderId: created.id } });
    }

    await tx.payment.create({
      data: {
        orderId: created.id,
        method: payload.paymentMethod,
        gateway: payload.paymentMethod.toLowerCase().includes("paystack") ? "paystack" : "manual",
        status: "UNPAID",
        amount: total
      }
    });

    return created;
  });

  const orderWithRelations = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { items: true, user: { select: { id:true, name:true, email:true, phone:true } } }
  });

  let invoice = { invoiceNumber: `INV-${order.id.slice(-6).toUpperCase()}`, url: "" };
  try {
    const inv = await generateInvoicePdf({ order: orderWithRelations, outputDir: "tmp/invoices" });
    await prisma.invoice.create({ data: { orderId: order.id, number: inv.invoiceNumber, url: inv.url } });
    invoice = inv;
  } catch (invoiceErr) {
    console.warn("[Order] Invoice generation failed (non-fatal):", invoiceErr);
    try {
      await prisma.invoice.create({ data: { orderId: order.id, number: invoice.invoiceNumber, url: "" } });
    } catch { /* already exists */ }
  }

  sendTemplateEmail({
    to: orderWithRelations.user.email,
    templateName: "order_confirmation",
    variables: { orderNumber: order.id.slice(-6).toUpperCase(), name: orderWithRelations.user.name }
  }).catch(() => {});

  return {
    ...orderWithRelations,
    invoice: { number: invoice.invoiceNumber, url: invoice.url },
    whatsappLink: buildWhatsAppLink(env.WHATSAPP_NUMBER, `Order ${order.id}: total ${total} via ${payload.paymentMethod}`)
  };
}

export const orderService = {
  create: (userId: string, payload: CreateOrderPayload) => createOrderInternal(userId, payload),

  async createGuest(payload: CreateOrderPayload & { guest: { name: string; email: string; phone: string } }) {
    const cleanEmail = payload.guest.email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: payload.guest.name,
          email: cleanEmail,
          phone: payload.guest.phone,
          password: await hashPassword(crypto.randomBytes(16).toString("hex"))
        }
      });
      sendTemplateEmail({
        to: cleanEmail,
        templateName: "welcome",
        variables: { name: payload.guest.name }
      }).catch(() => {});
    }
    return createOrderInternal(user.id, payload);
  },

  listForCustomer: (userId: string) =>
    prisma.order.findMany({
      where: { userId },
      include: { items: true, invoice: true },
      orderBy: { createdAt: "desc" }
    }),

  async listForAdmin(filters: any) {
    const page = Math.max(1, Number(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 50)));
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {})
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          user: { select: { id:true, name:true, email:true, phone:true } },
          payment: true,
          invoice: true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.order.count({ where })
    ]);

    return { data: orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
};
