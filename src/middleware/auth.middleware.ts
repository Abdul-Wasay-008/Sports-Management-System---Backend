import type { NextFunction, Request, Response } from "express";
import { UserModel } from "../models/User.js";
import { verifyAuthToken } from "../utils/jwt.js";

export interface AuthenticatedRequest extends Request {
  authUserId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.header("authorization") || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = verifyAuthToken(token);
    const user = await UserModel.findById(payload.sub).select("_id").lean();
    if (!user) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }

    req.authUserId = String(user._id);
    next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid authentication token." });
  }
}
