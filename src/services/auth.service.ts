import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../config/jwt.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { sendRawEmail, sendTemplateEmail } from "../utils/email.js";

function appError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function withoutPassword<T extends { password?: string }>(record: T) {
  const { password: _password, ...safe } = record;
  return safe;
}

export const authService = {
  async register(payload: { name: string; email: string; password: string; phone?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      throw appError("Email already exists", StatusCodes.CONFLICT);
    }

    const user = await prisma.user.create({
      data: {
        ...payload,
        password: await hashPassword(payload.password)
      }
    });

    await sendTemplateEmail({
      to: user.email,
      templateName: "welcome",
      variables: { name: user.name }
    });

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken(user.id, user.role);

    return { user: withoutPassword(user), accessToken, refreshToken };
  },

  async login(payload: { email: string; password: string }) {
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      throw appError("Invalid credentials", StatusCodes.UNAUTHORIZED);
    }

    const matched = await comparePassword(payload.password, user.password);
    if (!matched) {
      throw appError("Invalid credentials", StatusCodes.UNAUTHORIZED);
    }

    return {
      user: withoutPassword(user),
      accessToken: signAccessToken(user.id, user.role),
      refreshToken: signRefreshToken(user.id, user.role)
    };
  },

  async adminLogin(payload: { email: string; password: string }) {
    const admin = await prisma.admin.findUnique({ where: { email: payload.email } });
    if (!admin) {
      throw appError("Invalid admin credentials", StatusCodes.UNAUTHORIZED);
    }

    const matched = await comparePassword(payload.password, admin.password);
    if (!matched) {
      throw appError("Invalid admin credentials", StatusCodes.UNAUTHORIZED);
    }

    return {
      user: withoutPassword({ ...admin, role: admin.role }),
      accessToken: signAccessToken(admin.id, admin.role),
      refreshToken: signRefreshToken(admin.id, admin.role)
    };
  },

  // FIX: was missing async/await — now properly async
  async refreshToken(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    return {
      accessToken: signAccessToken(payload.sub, payload.role),
      refreshToken: signRefreshToken(payload.sub, payload.role)
    };
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const token = jwt.sign(
      {
        email: user.email,
        kind: "password_reset"
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    const resetUrl = `${env.FRONTEND_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
    await sendRawEmail({
      to: user.email,
      subject: "Reset your password",
      html: `<p>Hello ${user.name},</p><p>Use the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 15 minutes.</p>`
    });
  },

  async resetPassword(token: string, password: string) {
    let payload: { email?: string; kind?: string };
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { email?: string; kind?: string };
    } catch {
      throw appError("Reset token is invalid or expired", StatusCodes.BAD_REQUEST);
    }

    if (!payload.email || payload.kind !== "password_reset") {
      throw appError("Reset token is invalid", StatusCodes.BAD_REQUEST);
    }

    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      throw appError("User not found", StatusCodes.NOT_FOUND);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(password)
      }
    });
  },

  // ─── Change Password ────────────────────────────────────────────────────────
  // Works for both Admin and User models. Looks up admin first, falls back
  // to user table so a single endpoint serves all authenticated roles.
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Try admin table first (admin panel users), then regular users
    const admin = await prisma.admin.findUnique({ where: { id: userId } }).catch(() => null);
    const record = admin ?? await prisma.user.findUnique({ where: { id: userId } });

    if (!record) {
      throw appError("Account not found", StatusCodes.NOT_FOUND);
    }

    const matched = await comparePassword(currentPassword, record.password);
    if (!matched) {
      throw appError("Current password is incorrect", StatusCodes.UNAUTHORIZED);
    }

    const hashed = await hashPassword(newPassword);

    if (admin) {
      await prisma.admin.update({ where: { id: userId }, data: { password: hashed } });
    } else {
      await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    }
  },

  // ─── Change Email ───────────────────────────────────────────────────────────
  async changeEmail(userId: string, newEmail: string, password: string) {
    // Check new email not already taken in either table
    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email: newEmail } }).catch(() => null),
      prisma.admin.findUnique({ where: { email: newEmail } }).catch(() => null)
    ]);

    if (existingUser || existingAdmin) {
      throw appError("That email address is already in use", StatusCodes.CONFLICT);
    }

    const admin = await prisma.admin.findUnique({ where: { id: userId } }).catch(() => null);
    const record = admin ?? await prisma.user.findUnique({ where: { id: userId } });

    if (!record) {
      throw appError("Account not found", StatusCodes.NOT_FOUND);
    }

    const matched = await comparePassword(password, record.password);
    if (!matched) {
      throw appError("Password is incorrect", StatusCodes.UNAUTHORIZED);
    }

    if (admin) {
      await prisma.admin.update({ where: { id: userId }, data: { email: newEmail } });
    } else {
      await prisma.user.update({ where: { id: userId }, data: { email: newEmail } });
    }

    // Notify old email address about the change
    sendRawEmail({
      to: record.email,
      subject: "Your email address was changed",
      html: `<p>Hello,</p><p>The email address on your Pulse Commerce account was updated to <strong>${newEmail}</strong>.</p><p>If you did not make this change, please contact support immediately.</p>`
    }).catch(() => {});
  }
};
