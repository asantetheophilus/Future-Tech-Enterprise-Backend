import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";

import { env } from "./env.js";

export type JwtPayload = {
  sub: string;
  role: string;
  kind: "access" | "refresh";
};

function appError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export function signAccessToken(sub: string, role: string) {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign({ sub, role, kind: "access" } satisfies JwtPayload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(sub: string, role: string) {
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign({ sub, role, kind: "refresh" } satisfies JwtPayload, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  // FIXED: ensure this token is not a refresh token being passed as access
  if (payload.kind !== "access") {
    throw appError("Invalid token type", StatusCodes.UNAUTHORIZED);
  }
  return payload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  // FIXED: ensure this token is not an access token being passed as refresh
  if (payload.kind !== "refresh") {
    throw appError("Invalid token type", StatusCodes.UNAUTHORIZED);
  }
  return payload;
}
