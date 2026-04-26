// src/routes/paystack.routes.ts
// ============================================================
// IMPORTANT: The webhook route uses express.raw() instead of
// express.json() because Paystack signature verification
// requires the raw request body as a Buffer.
// ============================================================

import { Router } from "express";
import express from "express";

import {
  initializePayment,
  verifyPayment,
  handleWebhook,
  getPaymentStats,
  getPaystackSettings,
  savePaystackSettings,
} from "../controllers/paystack.controller.js";
import { isAuth } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const paystackRouter = Router();

// ─── Public: Webhook (raw body for signature verification) ───────────────────
// MUST be before any global JSON body parser.
// In app.ts, mount this router BEFORE express.json():
//   app.use("/api/paystack", paystackRouter);  ← before express.json()
//   app.use(express.json({ limit: "10mb" }));
//
// OR use the conditional raw body approach below (safer if you can't reorder).

paystackRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(handleWebhook)
);

// ─── Authenticated: Initialize payment ───────────────────────────────────────
paystackRouter.post(
  "/initialize",
  isAuth,
  asyncHandler(initializePayment)
);

// ─── Authenticated: Verify payment (called from frontend callback) ────────────
paystackRouter.get(
  "/verify/:reference",
  isAuth,
  asyncHandler(verifyPayment)
);

// ─── Admin: Payment stats dashboard ──────────────────────────────────────────
paystackRouter.get(
  "/stats",
  isAuth,
  isAdmin,
  asyncHandler(getPaymentStats)
);

// ─── Admin: Paystack configuration ───────────────────────────────────────────
paystackRouter.get(
  "/settings",
  isAuth,
  isAdmin,
  asyncHandler(getPaystackSettings)
);

paystackRouter.put(
  "/settings",
  isAuth,
  isAdmin,
  asyncHandler(savePaystackSettings)
);
