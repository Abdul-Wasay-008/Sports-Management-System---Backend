import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { decideRegistrationAsActor } from "../services/student.service.js";
import {
  getTeamManagerDashboard,
  listDemoQueue,
  listTeamManagerNotifications,
  markTeamManagerNotificationRead,
  parseDemoQueueStatusFilter,
} from "../services/team-manager.service.js";
import { AppError } from "../utils/errors.js";

function handleError(res: Response, err: unknown) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Something went wrong." });
}

function requireUserId(req: AuthenticatedRequest) {
  if (!req.authUserId) {
    throw new AppError("Authentication required.", 401);
  }
  return req.authUserId;
}

export async function teamManagerDashboardHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getTeamManagerDashboard(requireUserId(req));
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function teamManagerDemoQueueHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const statusFilter = parseDemoQueueStatusFilter(req.query.status);
    const data = await listDemoQueue(requireUserId(req), statusFilter);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function teamManagerNotificationsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await listTeamManagerNotifications(requireUserId(req));
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function teamManagerNotificationReadHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await markTeamManagerNotificationRead(requireUserId(req), String(req.params.id ?? ""));
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function teamManagerRegistrationDecisionHandler(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const status = String(req.body.status ?? "");
    if (status !== "accepted" && status !== "rejected") {
      throw new AppError("Status must be accepted or rejected.", 400);
    }
    const data = await decideRegistrationAsActor(
      { userId: requireUserId(req), role: "team_manager" },
      String(req.params.id ?? ""),
      status,
      String(req.body.note ?? ""),
    );
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}
