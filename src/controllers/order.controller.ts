import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import { orderService } from "../services/order.service.js";
import { sendResponse } from "../utils/response.js";
import { generateInvoicePdf } from "../utils/invoice.js";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "EDITOR", "SUPPORT"];

function isAdminRole(role?: string) {
  return ADMIN_ROLES.includes(role ?? "");
}

export const orderController = {
  async create(req: Request, res: Response) {
    // FIX: Admin tokens use Admin table IDs which don't exist in users table.
    // If the logged-in user is an admin, reject — they should use guest checkout
    // or a real customer account.
    if (isAdminRole(req.user?.role)) {
      return sendResponse(res, {
        success: false,
        statusCode: StatusCodes.FORBIDDEN,
        message: "Admin accounts cannot place customer orders. Please use a customer account.",
        data: null,
      });
    }

    // Verify user exists in users table before creating order
    const userExists = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true } });
    if (!userExists) {
      return sendResponse(res, {
        success: false,
        statusCode: StatusCodes.UNAUTHORIZED,
        message: "Customer account not found. Please log in as a customer.",
        data: null,
      });
    }

    const data = await orderService.create(req.user!.id, req.body);
    return sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: "Order placed successfully",
      data
    });
  },

  async createGuest(req: Request, res: Response) {
    const data = await orderService.createGuest(req.body);
    return sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: "Guest order placed successfully",
      data
    });
  },

  async customerOrders(req: Request, res: Response) {
    const data = await orderService.listForCustomer(req.user!.id);
    return sendResponse(res, { message: "Orders fetched", data });
  },

  async detail(req: Request, res: Response) {
    const data = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, invoice: true, payment: true, user: { select: { id: true, name: true, email: true, phone: true } } }
    });
    if (!data) {
      return sendResponse(res, {
        success: false,
        statusCode: StatusCodes.NOT_FOUND,
        message: "Order not found",
        data: null
      });
    }
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "EDITOR", "SUPPORT"].includes(req.user?.role ?? "");
    if (!isAdmin && req.user?.id !== data.userId) {
      return sendResponse(res, {
        success: false,
        statusCode: StatusCodes.FORBIDDEN,
        message: "You do not have permission to view this order",
        data: null
      });
    }
    return sendResponse(res, { message: "Order detail fetched", data });
  },

  async adminOrders(req: Request, res: Response) {
    const result = await orderService.listForAdmin(req.query);
    return sendResponse(res, {
      message: "Admin order list fetched",
      data: result.data,
      pagination: result.pagination
    });
  },

  async updateStatus(req: Request, res: Response) {
    const data = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: req.body.status }
    });
    return sendResponse(res, { message: "Order status updated", data });
  },

  async updatePayment(req: Request, res: Response) {
    const data = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: req.params.id },
        data: { paymentStatus: req.body.paymentStatus }
      });

      await tx.payment.updateMany({
        where: { orderId: req.params.id },
        data: {
          status: req.body.paymentStatus,
          paidAt: req.body.paymentStatus === "PAID" ? new Date() : null
        }
      });

      return order;
    });
    return sendResponse(res, { message: "Payment status updated", data });
  },

  async invoice(req: Request, res: Response) {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        invoice: true
      }
    });
    if (!order) {
      return sendResponse(res, {
        success: false,
        statusCode: StatusCodes.NOT_FOUND,
        message: "Order not found",
        data: null
      });
    }
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "EDITOR", "SUPPORT"].includes(req.user?.role ?? "");
    if (!isAdmin && req.user?.id !== order.userId) {
      return sendResponse(res, {
        success: false,
        statusCode: StatusCodes.FORBIDDEN,
        message: "You do not have permission to view this invoice",
        data: null
      });
    }

    // Always regenerate on request so old invoices get the improved layout,
    // phone number, delivery address, and notes without needing a new order.
    const generated = await generateInvoicePdf({ order, outputDir: "tmp/invoices" });
    const data = await prisma.invoice.upsert({
      where: { orderId: order.id },
      update: { number: generated.invoiceNumber, url: generated.url },
      create: { orderId: order.id, number: generated.invoiceNumber, url: generated.url }
    });

    return sendResponse(res, { message: "Invoice fetched", data });
  }
};
