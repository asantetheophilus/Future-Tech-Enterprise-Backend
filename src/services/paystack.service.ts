// src/services/paystack.service.ts
// Backend-only Paystack service. Supports keys from Admin Settings first,
// then falls back to backend .env.

import crypto from "crypto";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

const PAYSTACK_BASE = "https://api.paystack.co";

export interface PaystackInitResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyResult {
  status: "success" | "failed" | "abandoned" | "reversed";
  reference: string;
  amount: number;
  currency: string;
  customer: { email: string; name?: string };
  paid_at: string;
  gateway_response: string;
  metadata?: Record<string, unknown>;
}

async function getPaystackConfig() {
  const setting = await prisma.setting.findUnique({ where: { key: "paystack_config" } }).catch(() => null);
  const value = (setting?.value as Record<string, unknown> | null) ?? {};
  const secretKey = String(value.secretKey || env.PAYSTACK_SECRET_KEY || "");
  return {
    enabled: value.enabled !== false,
    publicKey: String(value.publicKey || env.PAYSTACK_PUBLIC_KEY || ""),
    secretKey,
    webhookSecret: String(value.secretKey || env.PAYSTACK_WEBHOOK_SECRET || secretKey || ""),
  };
}

function assertValidAmount(amountGHS: number) {
  if (!Number.isFinite(amountGHS) || amountGHS <= 0) {
    throw new Error("Invalid payment amount. Order total must be greater than zero.");
  }
}

async function paystackFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const config = await getPaystackConfig();
  if (!config.enabled) {
    throw new Error("Paystack is disabled in Admin > Settings > Payments.");
  }
  if (!config.secretKey || !config.secretKey.startsWith("sk_") || config.secretKey.includes("xxxxxxxx")) {
    throw new Error("Paystack secret key is not configured. Add a valid sk_test_ or sk_live_ key in Admin > Settings > Payments or backend .env.");
  }

  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const json = (await res.json().catch(() => null)) as { status: boolean; message: string; data: T } | null;
  if (!res.ok || !json?.status) {
    throw new Error(json?.message || `Paystack request failed (${res.status})`);
  }
  return json.data;
}

export const paystackService = {
  getConfig: getPaystackConfig,

  async initializePayment(params: {
    email: string;
    amountGHS: number;
    reference: string;
    orderId: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaystackInitResult> {
    if (!params.email || !params.email.includes("@")) {
      throw new Error("A valid customer email is required for Paystack payment.");
    }
    assertValidAmount(params.amountGHS);

    const callbackUrl =
      params.callbackUrl ??
      `${env.FRONTEND_URL}/checkout/payment-callback?reference=${encodeURIComponent(params.reference)}`;

    return paystackFetch<PaystackInitResult>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
        amount: Math.round(params.amountGHS * 100),
        reference: params.reference,
        callback_url: callbackUrl,
        currency: "GHS",
        metadata: { orderId: params.orderId, ...params.metadata },
        channels: ["card", "mobile_money", "bank", "bank_transfer"],
      }),
    });
  },

  async verifyPayment(reference: string): Promise<PaystackVerifyResult> {
    return paystackFetch<PaystackVerifyResult>(`/transaction/verify/${encodeURIComponent(reference)}`);
  },

  async verifyWebhookSignature(rawBody: Buffer, signature: string): Promise<boolean> {
    const config = await getPaystackConfig();
    if (!config.webhookSecret) {
      console.warn("[Paystack] webhook secret not set — skipping signature check");
      return true;
    }
    const hash = crypto.createHmac("sha512", config.webhookSecret).update(rawBody).digest("hex");
    return hash === signature;
  },

  generateReference(orderId: string): string {
    const tail = orderId.slice(-6).toUpperCase();
    const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `PCM-${tail}-${rand}`;
  },
};
