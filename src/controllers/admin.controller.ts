import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  createGame,
  createStudent,
  deleteGame,
  getLookups,
  getOverview,
  getStats,
  hardDeleteStudent,
  listGameRegistrations,
  listGames,
  listStudents,
  setStudentStatus,
  updateGame,
  updateStudent,
} from "../services/admin.service.js";
import {
  createResult,
  deleteResult,
  listResults,
  updateResult,
} from "../services/results.service.js";
import { AppError } from "../utils/errors.js";
import {
  parseOptionalDepartmentFilter,
  parseOptionalGenderFilter,
  parseStudentGender,
  sanitizeDepartment,
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

export async function adminOverviewHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getOverview();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminListStudentsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const status =
      req.query.status === "active" || req.query.status === "inactive" || req.query.status === "suspended"
        ? req.query.status
        : undefined;
    const gender =
      req.query.gender === "male" || req.query.gender === "female" ? req.query.gender : undefined;
    const department = parseOptionalDepartmentFilter(req.query.department);

    const data = await listStudents({
      search,
      status,
      gender,
      department,
      page,
      limit,
    });
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminCreateStudentHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await createStudent({
      name: String(req.body.name ?? ""),
      email: String(req.body.email ?? ""),
      registrationNumber: String(req.body.registrationNumber ?? ""),
      gender: parseStudentGender(req.body.gender),
      department: String(req.body.department ?? ""),
      password: String(req.body.password ?? ""),
    });
    return res.status(201).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminUpdateStudentHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id ?? "");
    const body = req.body as Record<string, unknown>;
    const patch: Parameters<typeof updateStudent>[1] = {};

    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.email === "string") patch.email = body.email;
    if (typeof body.registrationNumber === "string") patch.registrationNumber = body.registrationNumber;
    if (body.gender !== undefined) patch.gender = parseStudentGender(body.gender);
    if (typeof body.department === "string") patch.department = sanitizeDepartment(body.department);
    if (body.status === "active" || body.status === "inactive" || body.status === "suspended") {
      patch.status = body.status;
    }

    const data = await updateStudent(id, patch);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminSetStudentStatusHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = requireUserId(req);
    const id = String(req.params.id ?? "");
    const status = req.body?.status;
    if (status !== "active" && status !== "suspended") {
      throw new AppError("status must be active or suspended.", 400);
    }
    const data = await setStudentStatus(actorId, id, status);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminDeleteStudentHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = requireUserId(req);
    const id = String(req.params.id ?? "");
    const data = await hardDeleteStudent(actorId, id);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminListGamesHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const gender =
      typeof req.query.gender === "string" && ["male", "female", "mixed"].includes(req.query.gender)
        ? req.query.gender
        : undefined;
    const sportId = typeof req.query.sportId === "string" ? req.query.sportId : undefined;

    const data = await listGames({ search, gender, sportId });
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminCreateGameHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const slotMode =
      req.body.slotMode === "individual" || req.body.slotMode === "team"
        ? req.body.slotMode
        : "individual";
    const events = Array.isArray(req.body.events)
      ? (req.body.events as Array<{ name: string; perDepartmentPlayers: number }>)
      : undefined;

    const data = await createGame({
      title: String(req.body.title ?? ""),
      slug: String(req.body.slug ?? ""),
      description: String(req.body.description ?? ""),
      genderCategory: String(req.body.genderCategory ?? "") as "male" | "female" | "mixed",
      venue: String(req.body.venue ?? ""),
      rulesSummary: String(req.body.rulesSummary ?? ""),
      slotMode,
      perDepartmentPlayers: Number(req.body.perDepartmentPlayers ?? 0),
      events,
      managerId: String(req.body.managerId ?? ""),
      gameCategoryId: String(req.body.gameCategoryId ?? ""),
      isActive: typeof req.body.isActive === "boolean" ? req.body.isActive : undefined,
    });
    return res.status(201).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminUpdateGameHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id ?? "");
    const body = req.body as Record<string, unknown>;
    const patch: Parameters<typeof updateGame>[1] = {};

    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.slug === "string") patch.slug = body.slug;
    if (typeof body.description === "string") patch.description = body.description;
    if (typeof body.venue === "string") patch.venue = body.venue;
    if (typeof body.rulesSummary === "string") patch.rulesSummary = body.rulesSummary;
    if (body.genderCategory === "male" || body.genderCategory === "female" || body.genderCategory === "mixed") {
      patch.genderCategory = body.genderCategory;
    }
    if (body.slotMode === "individual" || body.slotMode === "team") {
      patch.slotMode = body.slotMode;
    }
    if (
      body.perDepartmentPlayers !== undefined &&
      body.perDepartmentPlayers !== null &&
      body.perDepartmentPlayers !== ""
    ) {
      patch.perDepartmentPlayers = Number(body.perDepartmentPlayers);
    }
    if (Array.isArray(body.events)) {
      patch.events = body.events as Array<{ name: string; perDepartmentPlayers: number }>;
    }
    if (typeof body.managerId === "string") patch.managerId = body.managerId;
    if (typeof body.gameCategoryId === "string") patch.gameCategoryId = body.gameCategoryId;
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

    const data = await updateGame(id, patch);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminDeleteGameHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id ?? "");
    const data = await deleteGame(id);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminGameRegistrationsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id ?? "");
    const status =
      typeof req.query.status === "string" &&
      ["demo_booked", "pending", "accepted", "rejected", "cancelled"].includes(req.query.status)
        ? req.query.status
        : undefined;

    const data = await listGameRegistrations(id, { status });
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminStatsHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getStats();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminLookupsHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getLookups();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

function parseDateQuery(value: unknown, label: string): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(`${label} must be a valid date.`, 400);
  }
  return d;
}

export async function adminListResultsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await listResults({
      gameId: typeof req.query.gameId === "string" ? req.query.gameId : undefined,
      gameCategoryId:
        typeof req.query.gameCategoryId === "string" ? req.query.gameCategoryId : undefined,
      gender: parseOptionalGenderFilter(req.query.gender),
      department: parseOptionalDepartmentFilter(req.query.department),
      from: parseDateQuery(req.query.from, "from"),
      to: parseDateQuery(req.query.to, "to"),
      limit:
        typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined,
    });
    return res.status(200).json({ results: data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminCreateResultHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body as Record<string, unknown>;
    const data = await createResult({
      gameId: typeof body.gameId === "string" ? body.gameId : undefined,
      gameTitle: typeof body.gameTitle === "string" ? body.gameTitle : undefined,
      gameCategoryId:
        typeof body.gameCategoryId === "string" ? body.gameCategoryId : undefined,
      genderCategory:
        typeof body.genderCategory === "string" ? body.genderCategory : undefined,
      winnerDepartment: String(body.winnerDepartment ?? ""),
      runnerUpDepartment:
        typeof body.runnerUpDepartment === "string" ? body.runnerUpDepartment : undefined,
      playedAt: typeof body.playedAt === "string" ? body.playedAt : undefined,
    });
    return res.status(201).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminUpdateResultHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id ?? "");
    const body = req.body as Record<string, unknown>;
    const patch: Parameters<typeof updateResult>[1] = {};
    if (typeof body.gameId === "string") patch.gameId = body.gameId;
    if (typeof body.gameTitle === "string") patch.gameTitle = body.gameTitle;
    if (typeof body.gameCategoryId === "string") patch.gameCategoryId = body.gameCategoryId;
    if (typeof body.genderCategory === "string") patch.genderCategory = body.genderCategory;
    if (typeof body.winnerDepartment === "string") patch.winnerDepartment = body.winnerDepartment;
    if (typeof body.runnerUpDepartment === "string") {
      patch.runnerUpDepartment = body.runnerUpDepartment;
    }
    if (typeof body.playedAt === "string") patch.playedAt = body.playedAt;
    const data = await updateResult(id, patch);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminDeleteResultHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id ?? "");
    const data = await deleteResult(id);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}
