import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  decideRegistration,
  getCommittee,
  getEligibleGames,
  getGameDetails,
  getGameManagers,
  getMyRegistrations,
  getNotifications,
  getResults,
  getRules,
  getSchedule,
  getStats,
  getStudentDashboard,
  registerForGame,
} from "../services/student.service.js";
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

export async function dashboardHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getStudentDashboard(requireUserId(req));
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function gamesHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getEligibleGames(requireUserId(req));
    return res.status(200).json({ games: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function gameDetailsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getGameDetails(requireUserId(req), String(req.params.id));
    return res.status(200).json({ game: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function registerGameHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await registerForGame(requireUserId(req), String(req.params.id));
    return res.status(201).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function myRegistrationsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getMyRegistrations(requireUserId(req));
    return res.status(200).json({ registrations: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function registrationDecisionHandler(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const status = String(req.body.status ?? "");
    if (status !== "accepted" && status !== "rejected") {
      throw new AppError("Status must be accepted or rejected.", 400);
    }
    const data = await decideRegistration(String(req.params.id), status, String(req.body.note ?? ""));
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function scheduleHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getSchedule();
    return res.status(200).json({ schedule: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function rulesHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getRules();
    return res.status(200).json({ rules: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function committeeHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getCommittee();
    return res.status(200).json({ committee: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function gameManagersHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getGameManagers();
    return res.status(200).json({ managers: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function resultsHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getResults();
    return res.status(200).json({ results: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function statsHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getStats();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function notificationsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getNotifications(requireUserId(req));
    return res.status(200).json({ notifications: data });
  } catch (err) {
    return handleError(res, err);
  }
}
