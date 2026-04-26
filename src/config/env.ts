import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),

  // FIX: Accepts a comma-separated list of allowed origins (no trailing slash, no spaces).
  // Local dev:   CORS_ORIGIN="http://localhost:3000"
  // With prod:   CORS_ORIGIN="http://localhost:3000,https://your-app.vercel.app"
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  EMAIL_HOST: z.string().min(1),
  EMAIL_PORT: z.coerce.number().default(587),
  EMAIL_USER: z.string().min(1),
  EMAIL_PASS: z.string().min(1),

  WHATSAPP_NUMBER: z.string().min(1),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  BACKEND_URL: z.string().default("http://localhost:5000"),

  // ─── Paystack ──────────────────────────────────────────────────────────────
  // Get keys from https://dashboard.paystack.com/#/settings/developers
  // Use TEST keys for sandbox, LIVE keys for production.
  PAYSTACK_PUBLIC_KEY: z.string().default(""),
  PAYSTACK_SECRET_KEY: z.string().default(""),
  // Webhook secret = your Paystack secret key (same key, used for HMAC-SHA512)
  PAYSTACK_WEBHOOK_SECRET: z.string().default(""),
});

export const env = envSchema.parse(process.env);
