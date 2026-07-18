import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./auth.middleware.js";
import { isSportsWeekActive } from "../services/sports-week-settings.service.js";

export async function requireSportsWeekActive(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const active = await isSportsWeekActive();
    if (!active) {
      return res.status(403).json({
        error: "Sports Week registrations are currently closed.",
        code: "SPORTS_WEEK_INACTIVE",
      });
    }
    next();
  } catch (_err) {
    return res.status(500).json({ error: "Could not verify sports week status." });
  }
}
