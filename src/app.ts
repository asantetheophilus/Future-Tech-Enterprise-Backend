import path from "node:path";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { apiRouter } from "./routes/index.js";
import { sendResponse } from "./utils/response.js";

export const app = express();

// ─── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGIN
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (incomingOrigin, callback) => {
    if (!incomingOrigin) return callback(null, true);
    if (allowedOrigins.includes(incomingOrigin)) return callback(null, true);
    callback(new Error(`CORS: origin '${incomingOrigin}' is not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Authorization"],
  maxAge: 86400,
};

app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

// ─── Serve local uploads and generated invoices ──────────────────────────────
// Images uploaded to disk are served at /uploads/<filename>.
const uploadsDir = path.resolve("uploads");
app.use("/uploads", express.static(uploadsDir, { maxAge: "7d" }));

// Generated PDF invoices are stored in tmp/invoices and served by the backend.
// Without this, /invoices/... opens on the frontend (:3000) and Next.js shows 404.
const invoicesDir = path.resolve("tmp/invoices");
app.use("/invoices", express.static(invoicesDir, {
  maxAge: "1h",
  setHeaders: (res) => {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
  }
}));
// ─── IMPORTANT: Paystack webhook MUST be registered BEFORE express.json() ─────
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  sendResponse(res, { message: "Server healthy", data: { uptime: process.uptime() } });
});

app.use("/api", apiRouter);
app.use(errorHandler);
