import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";

import { authService } from "../services/auth.service.js";
import { sendResponse } from "../utils/response.js";

// FIX: In production the frontend (Vercel) and backend (Render) are on different
//      domains.  Cookies with sameSite:"lax" are silently dropped by browsers on
//      cross-site requests.  We must use sameSite:"none" + secure:true when the
//      two apps are on different origins in production.
//      In development (localhost ↔ localhost) sameSite:"lax" still works fine.
function cookieOptions(res: Response) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,                          // HTTPS required for sameSite:"none"
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    maxAge: 7 * 24 * 60 * 60 * 1000,        // 7 days in milliseconds
  };
}

export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    res.cookie("refreshToken", result.refreshToken, cookieOptions(res));
    res.clearCookie("admin_token");
    return sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: "Registration successful",
      data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken },
    });
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    res.cookie("refreshToken", result.refreshToken, cookieOptions(res));
    res.clearCookie("admin_token");
    return sendResponse(res, {
      message: "Login successful",
      data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken },
    });
  },

  async adminLogin(req: Request, res: Response) {
    const result = await authService.adminLogin(req.body);
    const opts = cookieOptions(res);
    res.cookie("refreshToken", result.refreshToken, opts);
    // admin_token is a presence-only signal for the Next.js middleware guard
    res.cookie("admin_token", result.refreshToken, opts);
    return sendResponse(res, {
      message: "Admin login successful",
      data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken },
    });
  },

  async refreshToken(req: Request, res: Response) {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) {
      return sendResponse(res, {
        success: false,
        statusCode: StatusCodes.UNAUTHORIZED,
        message: "Refresh token is required",
        data: null,
      });
    }
    // FIX: was missing await — caused runtime crash returning undefined data
    const result = await authService.refreshToken(token);
    // Rotate the refresh token cookie
    res.cookie("refreshToken", result.refreshToken, cookieOptions(res));
    return sendResponse(res, { message: "Token refreshed", data: result });
  },

  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(req.body.email);
    return sendResponse(res, {
      message: "If this email exists, a reset link has been sent.",
      data: null,
    });
  },

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body.token, req.body.password);
    return sendResponse(res, { message: "Password reset successful", data: null });
  },

  async logout(_req: Request, res: Response) {
    const opts = { ...cookieOptions(res), maxAge: 0 };
    res.clearCookie("refreshToken", opts);
    res.clearCookie("admin_token", opts);
    return sendResponse(res, { message: "Logged out", data: null });
  },

  async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    return sendResponse(res, { message: "Password updated successfully", data: null });
  },

  async changeEmail(req: Request, res: Response) {
    const { newEmail, password } = req.body;
    await authService.changeEmail(req.user!.id, newEmail, password);
    return sendResponse(res, { message: "Email updated successfully", data: null });
  },
};
