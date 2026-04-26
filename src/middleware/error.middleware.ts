import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

type AppError = Error & { statusCode?: number; details?: unknown };

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Validation failed",
      data: err.flatten()
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "This request references data that no longer exists. Please refresh the page and try again.",
        data: { field: err.meta?.field_name ?? null }
      });
    }
    if (err.code === "P2002") {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: "A record with this value already exists.",
        data: { target: err.meta?.target ?? null }
      });
    }
  }

  const statusCode = err.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
  return res.status(statusCode).json({
    success: false,
    message: err.message || "Something went wrong",
    data: err.details ?? null
  });
}
