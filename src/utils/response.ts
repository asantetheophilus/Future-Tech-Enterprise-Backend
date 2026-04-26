import type { Response } from "express";
import { StatusCodes } from "http-status-codes";

type ResponseOptions = {
  success?: boolean;
  statusCode?: number;
  message: string;
  data?: unknown;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function sendResponse(res: Response, options: ResponseOptions) {
  const {
    success = true,
    statusCode = StatusCodes.OK,
    message,
    data = null,
    pagination
  } = options;

  return res.status(statusCode).json({
    success,
    message,
    data,
    ...(pagination ? { pagination } : {})
  });
}
