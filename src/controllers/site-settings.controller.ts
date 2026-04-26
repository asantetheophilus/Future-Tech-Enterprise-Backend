import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { sendResponse } from "../utils/response.js";

// Cast to any so we can use the siteSettings model before the generated
// Prisma client is regenerated against the live database.
// After running `npx prisma generate` this cast can be removed.
const db = prisma as any;

// Default site settings structure
const DEFAULTS: Record<string, { group: string; value: unknown }> = {
  brand: {
    group: "brand",
    value: {
      siteName: "Pulse Commerce",
      tagline: "Premium products trusted by thousands of shoppers across Ghana.",
      logoUrl: "",
      faviconUrl: "",
    },
  },
  hero: {
    group: "appearance",
    value: {
      title: "Own Your Next Upgrade",
      subtitle: "Modern electronics and accessories curated for speed.",
      ctaPrimary: "Shop Now",
      ctaSecondary: "View Lookbook",
      backgroundImage: "",
      stats: [
        { n: "10K+", label: "Happy Customers" },
        { n: "500+", label: "Products" },
        { n: "4.9★", label: "Rating" },
      ],
    },
  },
  about: {
    group: "appearance",
    value: {
      heading: "Why Choose Pulse Commerce?",
      body: "We are Ghana's premier destination for premium electronics and accessories. Every product is sourced and quality-checked to guarantee an exceptional shopping experience.",
      image: "",
    },
  },
  contact: {
    group: "contact",
    value: {
      email: "hello@pulsecommerce.com",
      phone: "+233 54 000 0000",
      whatsapp: "233540000000",
      address: "Accra, Ghana",
    },
  },
  social: {
    group: "social",
    value: {
      instagram: "#",
      twitter: "#",
      facebook: "#",
      youtube: "#",
    },
  },
  footer: {
    group: "footer",
    value: {
      description: "Premium products trusted by thousands of shoppers across Ghana.",
      columns: [
        {
          heading: "Shop",
          links: [
            { label: "All Products", href: "/products" },
            { label: "New Arrivals", href: "/products?sort=newest" },
            { label: "Best Sellers", href: "/products?sort=popular" },
            { label: "Categories", href: "/categories" },
            { label: "Deals & Offers", href: "/products" },
          ],
        },
        {
          heading: "Account",
          links: [
            { label: "Sign In", href: "/auth/login" },
            { label: "Create Account", href: "/auth/register" },
            { label: "My Orders", href: "/orders" },
            { label: "Wishlist", href: "/wishlist" },
            { label: "Track Order", href: "/orders" },
          ],
        },
        {
          heading: "Help",
          links: [
            { label: "Contact Us", href: "/contact" },
            { label: "Returns Policy", href: "#" },
            { label: "Shipping Info", href: "#" },
            { label: "FAQ", href: "#" },
          ],
        },
      ],
      trustBadges: [
        { icon: "🚚", label: "Fast Delivery", sub: "1–3 working days" },
        { icon: "🔒", label: "Secure Checkout", sub: "256-bit SSL encrypted" },
        { icon: "↩️", label: "Easy Returns", sub: "30-day hassle-free" },
        { icon: "💬", label: "WhatsApp Support", sub: "Order via chat" },
        { icon: "🏆", label: "Genuine Products", sub: "100% authenticity" },
      ],
      copyrightName: "Pulse Commerce",
    },
  },
  colors: {
    group: "appearance",
    value: {
      brand: "#2d6a4f",
      brandLight: "#40916c",
      brandPale: "#d8f3dc",
      accent: "#e76f51",
      bg: "#f7f6f3",
    },
  },
  promo: {
    group: "appearance",
    value: {
      barText: "Free delivery on orders over GH₵1,500",
      newsletterTitle: "Stay in the loop",
      newsletterSub: "New arrivals, exclusive deals & more — straight to your inbox.",
    },
  },
};

async function getOrCreateSetting(key: string) {
  const existing = await db.siteSettings.findUnique({ where: { key } });
  if (existing) return existing;
  const def = DEFAULTS[key];
  if (!def) return null;
  return db.siteSettings.create({
    data: { key, group: def.group, value: def.value as any },
  });
}

export const siteSettingsController = {
  // GET /api/site-settings  → returns all settings as { key: value } map
  async getAll(_req: Request, res: Response) {
    // Ensure all default keys exist
    await Promise.all(Object.keys(DEFAULTS).map((k) => getOrCreateSetting(k)));
    const rows = await db.siteSettings.findMany({ orderBy: { key: "asc" } });
    const map: Record<string, unknown> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return sendResponse(res, { message: "Site settings fetched", data: map });
  },

  // GET /api/site-settings/:key
  async getOne(req: Request, res: Response) {
    const setting = await getOrCreateSetting(req.params.key);
    return sendResponse(res, { message: "Setting fetched", data: setting?.value ?? null });
  },

  // PUT /api/site-settings/:key  { value: {...} }
  async update(req: Request, res: Response) {
    const { key } = req.params;
    const { value } = req.body as { value: unknown };
    if (value === undefined) {
      return res.status(400).json({ success: false, message: "value is required", data: null });
    }
    const updated = await db.siteSettings.upsert({
      where: { key },
      update: { value: value as any },
      create: {
        key,
        group: DEFAULTS[key]?.group ?? "general",
        value: value as any,
      },
    });
    return sendResponse(res, { message: "Setting updated", data: updated.value });
  },

  // PUT /api/site-settings  { key: "brand", value: {...} } bulk
  async updateBulk(req: Request, res: Response) {
    const updates = req.body as Array<{ key: string; value: unknown }>;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: "Expected array of { key, value }", data: null });
    }
    const results = await Promise.all(
      updates.map(({ key, value }) =>
        db.siteSettings.upsert({
          where: { key },
          update: { value: value as any },
          create: { key, group: DEFAULTS[key]?.group ?? "general", value: value as any },
        })
      )
    );
    return sendResponse(res, { message: "Settings updated", data: results });
  },
};
