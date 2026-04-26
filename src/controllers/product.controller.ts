import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import { productService } from "../services/product.service.js";
import { sendResponse } from "../utils/response.js";
import { hasCloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";

// Build the public URL for an uploaded file.
// Cloudinary: file.path is already the full HTTPS URL returned by multer-storage-cloudinary
// Local disk: file.path is a filesystem path like "uploads/filename.jpg" — convert to HTTP URL
function buildImageUrl(file: Express.Multer.File): string {
  if (hasCloudinary) {
    // Cloudinary multer sets file.path to the full Cloudinary URL
    return file.path;
  }
  // Local disk — serve via /uploads static route
  return `${env.BACKEND_URL}/uploads/${file.filename}`;
}

export const productController = {
  async list(req: Request, res: Response) {
    const result = await productService.list(req.query);
    return sendResponse(res, {
      message: "Products fetched",
      data: result.data,
      pagination: result.pagination
    });
  },

  async adminList(req: Request, res: Response) {
    const result = await productService.list(req.query, { includeInactive: true });
    return sendResponse(res, {
      message: "Admin products fetched",
      data: result.data,
      pagination: result.pagination
    });
  },

  async detail(req: Request, res: Response) {
    const data = await productService.detail(req.params.slug);
    return sendResponse(res, { message: "Product detail fetched", data });
  },

  async featured(_req: Request, res: Response) {
    const data = await productService.featured();
    return sendResponse(res, { message: "Featured products fetched", data });
  },

  async flashSale(_req: Request, res: Response) {
    const data = await productService.flashSale();
    return sendResponse(res, {
      message: "Flash sale fetched",
      data: data
        ? {
            ...data,
            endTime: data.endTime.toISOString()
          }
        : null
    });
  },

  async create(req: Request, res: Response) {
    const data = await productService.create(req.body);
    return sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: "Product created",
      data
    });
  },

  async update(req: Request, res: Response) {
    const data = await productService.update(req.params.id, req.body);
    return sendResponse(res, { message: "Product updated", data });
  },

  async remove(req: Request, res: Response) {
    await productService.remove(req.params.id);
    return sendResponse(res, { message: "Product deleted", data: null });
  },

  async uploadImages(req: Request, res: Response) {
    const files = (req.files ?? []) as Express.Multer.File[];
    if (!files.length) {
      return sendResponse(res, {
        success: false,
        statusCode: StatusCodes.BAD_REQUEST,
        message: "No image files were uploaded",
        data: null
      });
    }

    // Get current max sort order for this product
    const lastImage = await prisma.productImage.findFirst({
      where: { productId: req.params.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true }
    });
    const startOrder = (lastImage?.sortOrder ?? -1) + 1;

    // Check if product has any existing featured image
    const hasFeatured = await prisma.productImage.findFirst({
      where: { productId: req.params.id, isFeatured: true },
      select: { id: true }
    });

    const imageData = files.map((file, idx) => ({
      productId: req.params.id,
      url: buildImageUrl(file),
      publicId: hasCloudinary ? (file.filename || file.path) : file.filename,
      sortOrder: startOrder + idx,
      // Make the first uploaded image featured if there's no featured image yet
      isFeatured: !hasFeatured && idx === 0
    }));

    await prisma.productImage.createMany({ data: imageData });

    // Return created images so frontend can display them immediately
    const created = await prisma.productImage.findMany({
      where: { productId: req.params.id },
      orderBy: { sortOrder: "asc" }
    });

    return sendResponse(res, {
      message: `${files.length} image(s) uploaded successfully`,
      data: created
    });
  },

  async deleteImage(req: Request, res: Response) {
    await prisma.productImage.delete({ where: { id: req.params.imgId } });
    return sendResponse(res, { message: "Product image deleted", data: null });
  },

  async featureImage(req: Request, res: Response) {
    const { id, imgId } = req.params;
    await prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: { productId: id },
        data: { isFeatured: false }
      });
      await tx.productImage.update({
        where: { id: imgId },
        data: { isFeatured: true }
      });
    });

    return sendResponse(res, { message: "Featured image updated", data: null });
  },

  async reorderImages(req: Request, res: Response) {
    const { id } = req.params;
    const imageIds = Array.isArray(req.body?.imageIds) ? req.body.imageIds : [];
    await prisma.$transaction(
      imageIds.map((imageId: string, index: number) =>
        prisma.productImage.updateMany({
          where: { id: imageId, productId: id },
          data: { sortOrder: index }
        })
      )
    );
    return sendResponse(res, { message: "Image order updated", data: null });
  }
};


