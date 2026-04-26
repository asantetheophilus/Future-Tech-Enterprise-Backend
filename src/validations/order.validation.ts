import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive()
});

const addressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  city: z.string().min(2),
  street: z.string().min(3),
  country: z.string().min(2)
});

const orderBaseSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  address: addressSchema,
  // FIX: Accept all valid payment method strings (paystack, cod variants, pay on delivery)
  paymentMethod: z.string().min(1).default("Pay on Delivery"),
  notes: z.string().optional(),
  couponCode: z.string().optional()
});

export const createOrderSchema = z.object({
  body: orderBaseSchema
});

export const createGuestOrderSchema = z.object({
  body: orderBaseSchema.extend({
    guest: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(8)
    })
  })
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(["PLACED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"])
  })
});

export const updatePaymentStatusSchema = z.object({
  body: z.object({
    paymentStatus: z.enum(["UNPAID", "PAID", "REFUNDED"])
  })
});
