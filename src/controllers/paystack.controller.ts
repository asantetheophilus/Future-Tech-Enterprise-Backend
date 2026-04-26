// src/controllers/paystack.controller.ts
// ============================================================
// Paystack Controller
// Routes:
//   POST /api/paystack/initialize   → create order + init payment
//   GET  /api/paystack/verify/:ref  → verify after redirect
//   POST /api/paystack/webhook      → Paystack server → backend
// ============================================================

import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { paystackService } from "../services/paystack.service.js";
import { sendResponse } from "../utils/response.js";

// ─── Initialize Payment ───────────────────────────────────────────────────────

export async function initializePayment(req: Request, res: Response) {
  const userId = req.user!.id;
  const userRole = req.user!.role;

  // FIX: Admin accounts have IDs from the Admin table (not User table).
  // Orders are linked to User table — admin tokens cannot own orders.
  const adminRoles = ["ADMIN", "SUPER_ADMIN", "EDITOR", "SUPPORT"];
  if (adminRoles.includes(userRole)) {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.FORBIDDEN,
      message: "Admin accounts cannot initialize payments. Use a customer account.",
      data: null,
    });
  }

  // 1. Validate body
  const { orderId } = req.body as { orderId: string };
  if (!orderId) {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.BAD_REQUEST,
      message: "orderId is required",
      data: null,
    });
  }

  // 2. Fetch order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { id: true, name: true, email: true, phone: true } }, payment: true },
  });

  if (!order) {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.NOT_FOUND,
      message: "Order not found",
      data: null,
    });
  }

  // 3. Ownership check
  if (order.userId !== userId) {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.FORBIDDEN,
      message: "You do not own this order",
      data: null,
    });
  }

  // 4. Already paid?
  if (order.paymentStatus === "PAID") {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.CONFLICT,
      message: "Order is already paid",
      data: null,
    });
  }

  // 5. Check Paystack secret key is configured. Admin settings override .env.
  const paystackConfig = await paystackService.getConfig();
  if (!paystackConfig.enabled || !paystackConfig.secretKey || !paystackConfig.secretKey.startsWith("sk_") || paystackConfig.secretKey.includes("xxxxxxxx")) {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.SERVICE_UNAVAILABLE,
      message: "Paystack is not configured. Add a valid sk_test_ or sk_live_ key in Admin > Settings > Payments or backend .env.",
      data: null,
    });
  }

  // 6. Generate reference
  const reference = paystackService.generateReference(orderId);

  // 7. Upsert Payment record (status = UNPAID, gateway = paystack)
  await prisma.payment.upsert({
    where: { orderId },
    create: {
      orderId,
      method: "paystack",
      gateway: "paystack",
      status: "UNPAID",
      reference,
      paystackRef: reference,
      amount: order.total,
    },
    update: {
      reference,
      paystackRef: reference,
      gateway: "paystack",
      method: "paystack",
    },
  });

  // 8. Call Paystack API
  let result;
  try {
    result = await paystackService.initializePayment({
      email: order.user.email,
      amountGHS: Number(order.total),
      reference,
      orderId,
    });
  } catch (paystackErr: any) {
    const message = paystackErr?.message?.replace("Paystack error: ", "") ?? "Payment initialization failed";
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.BAD_GATEWAY,
      message: `Paystack error: ${message}`,
      data: null,
    });
  }

  return sendResponse(res, {
    statusCode: StatusCodes.OK,
    message: "Payment initialized",
    data: {
      authorizationUrl: result.authorization_url,
      accessCode: result.access_code,
      reference,
    },
  });
}

// ─── Verify Payment (callback redirect) ──────────────────────────────────────
// Called from the frontend after Paystack redirects back.
// We verify with Paystack API here, but the REAL source of truth is the webhook.
// This gives immediate UX feedback.

export async function verifyPayment(req: Request, res: Response) {
  const { reference } = req.params as { reference: string };

  if (!reference) {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.BAD_REQUEST,
      message: "reference is required",
      data: null,
    });
  }

  // Verify with Paystack
  const result = await paystackService.verifyPayment(reference);

  if (result.status !== "success") {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.PAYMENT_REQUIRED,
      message: `Payment ${result.status}`,
      data: { status: result.status, reference },
    });
  }

  // Find payment record
  const payment = await prisma.payment.findFirst({
    where: { paystackRef: reference },
    include: { order: true },
  });

  if (!payment) {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.NOT_FOUND,
      message: "Payment record not found",
      data: null,
    });
  }

  // If not yet processed by webhook, mark paid here too
  if (payment.status !== "PAID") {
    await markOrderPaid(payment.orderId, reference, result);
  }

  return sendResponse(res, {
    statusCode: StatusCodes.OK,
    message: "Payment verified successfully",
    data: {
      orderId: payment.orderId,
      reference,
      status: "success",
    },
  });
}

// ─── Webhook ──────────────────────────────────────────────────────────────────
// IMPORTANT: This route MUST receive the raw body buffer.
// See paystack.routes.ts for express.raw() middleware.

export async function handleWebhook(req: Request, res: Response) {
  // 1. Verify signature using raw body
  const signature = req.headers["x-paystack-signature"] as string;
  const rawBody = req.body as Buffer;

  const isValid = await paystackService.verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.error("[Paystack Webhook] Invalid signature");
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Invalid signature" });
  }

  // 2. Parse event
  let event: { event: string; data: { reference: string } };
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid JSON" });
  }

  // 3. Acknowledge immediately (Paystack retries if no 200 within 30s)
  res.status(StatusCodes.OK).json({ received: true });

  // 4. Process async — only care about charge.success
  if (event.event !== "charge.success") {
    console.log(`[Paystack Webhook] Ignoring event: ${event.event}`);
    return;
  }

  const { reference } = event.data;

  // 5. Check for duplicate processing
  const existingPayment = await prisma.payment.findFirst({
    where: { paystackRef: reference },
  });

  if (!existingPayment) {
    console.error(`[Paystack Webhook] No payment record for ref: ${reference}`);
    return;
  }

  if (existingPayment.processedAt) {
    console.log(`[Paystack Webhook] Already processed: ${reference}`);
    return;
  }

  // 6. Verify with Paystack API (never trust webhook alone)
  let verifyResult;
  try {
    verifyResult = await paystackService.verifyPayment(reference);
  } catch (err) {
    console.error(`[Paystack Webhook] Verify failed for ${reference}:`, err);
    return;
  }

  if (verifyResult.status !== "success") {
    console.warn(`[Paystack Webhook] Verify returned: ${verifyResult.status} for ${reference}`);
    return;
  }

  // 7. Mark order as paid
  await markOrderPaid(existingPayment.orderId, reference, verifyResult);
  console.log(`[Paystack Webhook] ✅ Order ${existingPayment.orderId} marked PAID`);
}

// ─── Admin: Payment Stats ─────────────────────────────────────────────────────

export async function getPaymentStats(_req: Request, res: Response) {
  const [total, paid, failed, recent, revenue] = await Promise.all([
    prisma.payment.count(),
    prisma.payment.count({ where: { status: "PAID" } }),
    prisma.payment.count({ where: { status: "UNPAID" } }),
    prisma.payment.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "PAID" },
    }),
  ]);

  return sendResponse(res, {
    message: "Payment stats fetched",
    data: {
      total,
      paid,
      failed: failed,
      totalRevenue: Number(revenue._sum.amount ?? 0),
      recentTransactions: recent.map((p) => ({
        id: p.id,
        reference: p.paystackRef ?? p.reference,
        amount: Number(p.amount),
        status: p.status,
        gateway: p.gateway,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        customer: p.order?.user?.name ?? "Guest",
        customerEmail: p.order?.user?.email ?? "",
        orderId: p.orderId,
      })),
    },
  });
}

// ─── Admin: Toggle Paystack ───────────────────────────────────────────────────

export async function getPaystackSettings(_req: Request, res: Response) {
  const setting = await prisma.setting.findUnique({
    where: { key: "paystack_config" },
  });
  const config = (setting?.value as Record<string, unknown>) ?? {};
  // Never expose secret key
  return sendResponse(res, {
    message: "Paystack settings fetched",
    data: {
      enabled: config.enabled ?? false,
      publicKey: config.publicKey ?? "",
      // secretKey intentionally omitted
    },
  });
}

export async function savePaystackSettings(req: Request, res: Response) {
  const { enabled, publicKey, secretKey } = req.body as {
    enabled: boolean;
    publicKey: string;
    secretKey?: string;
  };

  if (publicKey && !publicKey.startsWith("pk_")) {
    return sendResponse(res, { success: false, statusCode: StatusCodes.BAD_REQUEST, message: "Invalid Paystack public key. It must start with pk_test_ or pk_live_", data: null });
  }
  if (secretKey && !secretKey.startsWith("sk_")) {
    return sendResponse(res, { success: false, statusCode: StatusCodes.BAD_REQUEST, message: "Invalid Paystack secret key. It must start with sk_test_ or sk_live_", data: null });
  }

  const existing = await prisma.setting.findUnique({
    where: { key: "paystack_config" },
  });
  const prev = (existing?.value as Record<string, unknown>) ?? {};

  await prisma.setting.upsert({
    where: { key: "paystack_config" },
    create: {
      key: "paystack_config",
      group: "payment",
      value: {
        enabled: enabled ?? false,
        publicKey: publicKey ?? "",
        secretKey: secretKey ?? prev.secretKey ?? "",
      },
    },
    update: {
      value: {
        enabled: enabled ?? prev.enabled ?? false,
        publicKey: publicKey ?? prev.publicKey ?? "",
        // Only update secret if explicitly provided
        secretKey: secretKey ? secretKey : (prev.secretKey ?? ""),
      },
    },
  });

  return sendResponse(res, {
    message: "Paystack settings saved",
    data: null,
  });
}

// ─── Internal Helper ──────────────────────────────────────────────────────────

async function markOrderPaid(
  orderId: string,
  reference: string,
  verifyResult: { paid_at: string; status: string; amount: number; metadata?: Record<string, unknown> }
) {
  const now = new Date();

  await prisma.$transaction([
    // Update payment record
    prisma.payment.updateMany({
      where: { orderId, paystackRef: reference },
      data: {
        status: "PAID",
        paidAt: new Date(verifyResult.paid_at),
        processedAt: now,
        gatewayData: verifyResult as any,
      },
    }),

    // Update order payment status
    prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        // Optionally auto-advance order status
        status: "PACKED",
      },
    }),
  ]);

  // Clear user cart if they have one
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true },
  });

  if (order?.userId) {
    await prisma.cart.updateMany({
      where: { userId: order.userId },
      data: { items: [] },
    }).catch(() => {/* cart clear is best-effort */});
  }
}
