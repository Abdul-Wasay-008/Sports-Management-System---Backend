import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getDemoSlotsForGame,
  getDepartmentTeamManagers,
  getDepartmentTrends,
  getGameCategories,
  getCommittee,
  getEligibleGames,
  getGameDetails,
  getGameManagers,
  getMyRegistrations,
  getMyStats,
  getNotifications,
  getResults,
  getRules,
  getSchedule,
  getStats,
  getStudentDashboard,
  getStudentResultsStandings,
  registerForDemo,
  registerForGame,
} from "../services/student.service.js";
import { AppError } from "../utils/errors.js";
import {
  parseOptionalDepartmentFilter,
  parseOptionalGenderFilter,
} from "../utils/validators.js";

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
    const data = await getEligibleGames(requireUserId(req), {
      department: parseOptionalDepartmentFilter(req.query.department),
      gender: parseOptionalGenderFilter(req.query.gender),
      gameCategoryId: typeof req.query.gameCategoryId === "string" ? req.query.gameCategoryId : undefined,
      gameId: typeof req.query.gameId === "string" ? req.query.gameId : undefined,
    });
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

export async function demoSlotsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : undefined;
    const data = await getDemoSlotsForGame(requireUserId(req), String(req.params.id), weekStart);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function registerDemoHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const startsAt = String((req.body as { startsAt?: string }).startsAt ?? "");
    if (!startsAt.trim()) {
      throw new AppError("startsAt is required (ISO 8601).", 400);
    }
    const data = await registerForDemo(requireUserId(req), String(req.params.id), startsAt.trim());
    return res.status(201).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function myRegistrationsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getMyRegistrations(requireUserId(req), {
      department: parseOptionalDepartmentFilter(req.query.department),
      gender: parseOptionalGenderFilter(req.query.gender),
      gameId: typeof req.query.gameId === "string" ? req.query.gameId : undefined,
    });
    return res.status(200).json({ registrations: data });
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

export async function gameManagersHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getGameManagers(requireUserId(req), {
      gender: parseOptionalGenderFilter(req.query.gender),
      gameCategoryId: typeof req.query.gameCategoryId === "string" ? req.query.gameCategoryId : undefined,
    });
    return res.status(200).json({ managers: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function resultsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getResults(requireUserId(req), {
      department: parseOptionalDepartmentFilter(req.query.department),
      gender: parseOptionalGenderFilter(req.query.gender),
      gameCategoryId: typeof req.query.gameCategoryId === "string" ? req.query.gameCategoryId : undefined,
      gameId: typeof req.query.gameId === "string" ? req.query.gameId : undefined,
      from: parseDateQueryParam(req.query.from, "from"),
      to: parseDateQueryParam(req.query.to, "to"),
    });
    return res.status(200).json({ results: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function statsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getStats(requireUserId(req), {
      department: parseOptionalDepartmentFilter(req.query.department),
      gender: parseOptionalGenderFilter(req.query.gender),
      gameCategoryId: typeof req.query.gameCategoryId === "string" ? req.query.gameCategoryId : undefined,
    });
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

export async function departmentTeamManagersHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getDepartmentTeamManagers(requireUserId(req), {
      department: parseOptionalDepartmentFilter(req.query.department),
      gender: parseOptionalGenderFilter(req.query.gender),
      gameCategoryId: typeof req.query.gameCategoryId === "string" ? req.query.gameCategoryId : undefined,
    });
    return res.status(200).json({ teamManagers: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function gameCategoriesHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getGameCategories();
    return res.status(200).json({ categories: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function myStatsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getMyStats(requireUserId(req));
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function departmentTrendsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getDepartmentTrends(requireUserId(req));
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

function parseDateQueryParam(value: unknown, label: string): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(`${label} must be a valid date.`, 400);
  }
  return d;
}

export async function resultsStandingsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getStudentResultsStandings(requireUserId(req), {
      gameCategoryId:
        typeof req.query.gameCategoryId === "string" ? req.query.gameCategoryId : undefined,
      gender: parseOptionalGenderFilter(req.query.gender),
      from: parseDateQueryParam(req.query.from, "from"),
      to: parseDateQueryParam(req.query.to, "to"),
    });
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}
