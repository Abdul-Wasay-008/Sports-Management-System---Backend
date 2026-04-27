import type { NextFunction, Response } from "express";
import { UserModel } from "../models/User.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const user = await UserModel.findById(req.authUserId).select("role status").lean();
    if (!user || user.role !== "admin" || user.status !== "active") {
      return res.status(403).json({ error: "Administrator access required." });
    }

    next();
  } catch (_err) {
    return res.status(403).json({ error: "Administrator access required." });
  }
}
