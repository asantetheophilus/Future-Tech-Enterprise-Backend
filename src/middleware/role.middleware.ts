import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !["ADMIN", "SUPER_ADMIN", "EDITOR", "SUPPORT"].includes(req.user.role)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "Admin access required",
      data: null
    });
  }
  return next();
}

export function isOwner(req: Request, res: Response, next: NextFunction) {
  const id = req.params.id ?? req.body.userId;
  if (!req.user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Authentication required",
      data: null
    });
  }
  if (req.user.id !== id && !["ADMIN", "SUPER_ADMIN", "EDITOR"].includes(req.user.role)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "You do not have permission to perform this action",
      data: null
    });
  }
  return next();
}

export function isVendor(_req: Request, res: Response) {
  return res.status(StatusCodes.FORBIDDEN).json({
    success: false,
    message: "Vendor endpoints are not enabled yet", // [VENDOR READY]
    data: null
  });
}
