import fs from "node:fs";
import path from "node:path";

import PDFDocument from "pdfkit";

import type { Order, OrderItem } from "@prisma/client";

type CustomerLike = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

type AddressLike = {
  fullName?: string | null;
  phone?: string | null;
  city?: string | null;
  street?: string | null;
  country?: string | null;
  region?: string | null;
  address?: string | null;
  location?: string | null;
  deliveryLocation?: string | null;
  notes?: string | null;
};

type InvoiceInput = {
  order: Order & {
    items: OrderItem[];
    user: CustomerLike;
  };
  outputDir: string;
};

function asAddress(value: unknown): AddressLike {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AddressLike;
  }
  return {};
}

function textOrFallback(value: unknown, fallback = "Not provided") {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `GH¢${amount.toFixed(2)}`;
}

function joinParts(parts: Array<unknown>) {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

function drawKeyValue(doc: any, label: string, value: string) {
  doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(value);
}

export async function generateInvoicePdf({ order, outputDir }: InvoiceInput) {
  const invoiceNumber = `INV-${order.id.slice(-6).toUpperCase()}`;
  const filename = `${invoiceNumber}.pdf`;

  const absoluteOutputDir = outputDir.startsWith("/") ? outputDir : path.join(process.cwd(), outputDir);
  const absolutePath = path.join(absoluteOutputDir, filename);

  await fs.promises.mkdir(absoluteOutputDir, { recursive: true });

  const address = asAddress(order.address);
  const customerName = textOrFallback(address.fullName ?? order.user?.name);
  const customerEmail = textOrFallback(order.user?.email);
  const customerPhone = textOrFallback(address.phone ?? order.user?.phone);
  const deliveryLocation = textOrFallback(
    joinParts([
      address.street ?? address.address ?? address.location ?? address.deliveryLocation,
      address.city,
      address.region,
      address.country,
    ])
  );
  const deliveryNotes = textOrFallback(order.notes ?? address.notes);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(absolutePath);
    doc.pipe(stream);

    // Header
    doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text("Pulse Commerce", { align: "left" });
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10).fillColor("#6b7280");
    doc.text(`Invoice Number: ${invoiceNumber}`);
    doc.text(`Order Number: #${order.id.slice(-8).toUpperCase()}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}`);
    doc.moveDown(1.2);

    // Customer + delivery information
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text("Customer Information");
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor("#111827");
    drawKeyValue(doc, "Customer", customerName);
    drawKeyValue(doc, "Email", customerEmail);
    drawKeyValue(doc, "Phone", customerPhone);
    doc.moveDown(0.9);

    doc.font("Helvetica-Bold").fontSize(13).text("Delivery Information");
    doc.moveDown(0.4);
    doc.fontSize(11);
    drawKeyValue(doc, "Location / Address", deliveryLocation);
    drawKeyValue(doc, "Delivery Notes", deliveryNotes);
    drawKeyValue(doc, "Order Status", textOrFallback(order.status));
    drawKeyValue(doc, "Payment Status", textOrFallback(order.paymentStatus));
    drawKeyValue(doc, "Payment Method", textOrFallback(order.paymentMethod));
    doc.moveDown(1.2);

    // Items table
    const tableTop = doc.y;
    const itemX = 40;
    const qtyX = 340;
    const priceX = 405;
    const totalX = 490;

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("Items", itemX, tableTop);
    doc.moveTo(itemX, doc.y + 4).lineTo(555, doc.y + 4).strokeColor("#e5e7eb").stroke();
    doc.moveDown(0.8);

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151");
    doc.text("Item", itemX, doc.y, { width: 280 });
    doc.text("Qty", qtyX, doc.y - 12, { width: 45, align: "right" });
    doc.text("Price", priceX, doc.y - 12, { width: 70, align: "right" });
    doc.text("Subtotal", totalX, doc.y - 12, { width: 65, align: "right" });
    doc.moveDown(0.4);
    doc.moveTo(itemX, doc.y).lineTo(555, doc.y).strokeColor("#e5e7eb").stroke();
    doc.moveDown(0.4);

    doc.font("Helvetica").fontSize(10).fillColor("#111827");
    for (const item of order.items) {
      const rowY = doc.y;
      doc.text(item.name, itemX, rowY, { width: 280 });
      doc.text(String(item.quantity), qtyX, rowY, { width: 45, align: "right" });
      doc.text(money(item.price), priceX, rowY, { width: 70, align: "right" });
      doc.text(money(item.subtotal), totalX, rowY, { width: 65, align: "right" });
      doc.moveDown(0.7);
    }

    doc.moveTo(itemX, doc.y + 2).lineTo(555, doc.y + 2).strokeColor("#e5e7eb").stroke();
    doc.moveDown(1);

    const totalsX = 365;
    const valuesX = 490;
    doc.fontSize(11).fillColor("#111827");
    doc.text("Subtotal", totalsX, doc.y, { width: 110 });
    doc.text(money(order.subtotal), valuesX, doc.y - 13, { width: 65, align: "right" });
    doc.moveDown(0.5);
    doc.text("Delivery Fee", totalsX, doc.y, { width: 110 });
    doc.text(money(order.deliveryFee), valuesX, doc.y - 13, { width: 65, align: "right" });
    doc.moveDown(0.5);
    doc.text("Discount", totalsX, doc.y, { width: 110 });
    doc.text(money(order.discount), valuesX, doc.y - 13, { width: 65, align: "right" });
    doc.moveDown(0.4);
    doc.moveTo(totalsX, doc.y).lineTo(555, doc.y).strokeColor("#e5e7eb").stroke();
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(13).text("Total", totalsX, doc.y, { width: 110 });
    doc.text(money(order.total), valuesX, doc.y - 16, { width: 65, align: "right" });

    doc.moveDown(2);
    doc.font("Helvetica").fontSize(11).fillColor("#6b7280").text("Thank you for your purchase.");
    doc.end();

    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  return { invoiceNumber, absolutePath, url: `/invoices/${filename}` };
}
