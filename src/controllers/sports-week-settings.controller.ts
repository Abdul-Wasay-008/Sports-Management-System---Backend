import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getSportsWeekSettings,
  updateSportsWeekSettings,
} from "../services/sports-week-settings.service.js";
import { AppError } from "../utils/errors.js";

function handleError(res: Response, err: unknown) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Something went wrong." });
}

/** Public — no auth required */
export async function publicSportsWeekStatusHandler(_req: Request, res: Response) {
  try {
    const data = await getSportsWeekSettings();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

/** Admin GET */
export async function adminGetSportsWeekSettingsHandler(
  _req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const data = await getSportsWeekSettings();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

/** Admin PATCH */
export async function adminUpdateSportsWeekSettingsHandler(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.authUserId) throw new AppError("Authentication required.", 401);
    const data = await updateSportsWeekSettings(req.body ?? {}, req.authUserId);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}
