import path from "node:path";
import fs from "node:fs";

import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

import { env } from "./env.js";

// Detect whether real Cloudinary credentials are configured
const hasCloudinary =
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_CLOUD_NAME !== "demo" &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_KEY !== "demo" &&
  env.CLOUDINARY_API_SECRET &&
  env.CLOUDINARY_API_SECRET !== "demo";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
});

// ─── Local disk storage (fallback when Cloudinary is not configured) ──────────
const UPLOADS_DIR = path.resolve("uploads");
if (!hasCloudinary) {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.info("[Upload] Cloudinary not configured — using local disk storage at /uploads");
}

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

// ─── Cloudinary storage ───────────────────────────────────────────────────────
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "ecommerce",
    resource_type: "image",
    quality: "auto",
    fetch_format: "auto"
  })
});

export const upload = multer({
  storage: hasCloudinary ? cloudinaryStorage : localDiskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed."));
      return;
    }
    cb(null, true);
  }
});

export { cloudinary, hasCloudinary, UPLOADS_DIR };
