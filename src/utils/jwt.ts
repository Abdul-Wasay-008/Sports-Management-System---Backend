import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

interface AuthTokenPayload {
  sub: string;
  email: string;
  role: "student";
}

function getJwtSecret() {
  if (!env.jwtSecret) {
    throw new AppError("JWT_SECRET is not configured on the server.", 500);
  }
  return env.jwtSecret;
}

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
}
