import { Types } from "mongoose";
import {
  GAME_GENDERS,
  SPORTS_WEEK_DEPARTMENTS,
  normalizeDepartment,
  type GameGender,
  type SportsWeekDepartment,
} from "../constants/sports-week.js";
import { GameModel } from "../models/Game.js";
import { GameCategoryModel } from "../models/GameCategory.js";
import { ResultModel } from "../models/Result.js";
import { AppError } from "../utils/errors.js";

type CreateResultInput = {
  gameId?: string;
  gameTitle?: string;
  gameCategoryId?: string;
  genderCategory?: string;
  winnerDepartment: string;
  runnerUpDepartment?: string;
  playedAt?: string | Date;
};

type UpdateResultInput = Partial<CreateResultInput>;

type ListResultsParams = {
  gameId?: string;
  gameCategoryId?: string;
  gender?: GameGender;
  department?: SportsWeekDepartment;
  from?: Date;
  to?: Date;
  limit?: number;
};

function asObjectId(value: string | undefined, label: string) {
  if (!value) return undefined;
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
  return new Types.ObjectId(value);
}

function sanitizeResultDepartment(value: string, label: string) {
  const normalized = normalizeDepartment(value);
  if (!normalized) {
    throw new AppError(`${label} must be a valid Sports Week department.`, 400);
  }
  return normalized;
}

function parseGenderCategory(value: string | undefined): GameGender | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const lowered = String(value).trim().toLowerCase();
  if (!GAME_GENDERS.includes(lowered as GameGender)) {
    throw new AppError("genderCategory must be male, female, or mixed.", 400);
  }
  return lowered as GameGender;
}

function parseDate(value: string | Date | undefined, fallbackToNow = false) {
  if (value === undefined || value === null || value === "") {
    return fallbackToNow ? new Date() : undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("playedAt must be a valid date.", 400);
  }
  return date;
}

/**
 * Admin: create a Result. Optionally pulls denormalized fields (gameTitle,
 * gameCategoryId, genderCategory) from the referenced Game when not supplied.
 */
export async function createResult(input: CreateResultInput) {
  if (!input.winnerDepartment?.trim()) {
    throw new AppError("winnerDepartment is required.", 400);
  }

  const winnerDepartment = sanitizeResultDepartment(
    input.winnerDepartment,
    "winnerDepartment",
  );
  const runnerUpDepartment = input.runnerUpDepartment?.trim()
    ? sanitizeResultDepartment(input.runnerUpDepartment, "runnerUpDepartment")
    : undefined;

  if (runnerUpDepartment && runnerUpDepartment === winnerDepartment) {
    throw new AppError("Runner-up cannot be the same as the winner.", 400);
  }

  const gameObjectId = asObjectId(input.gameId, "gameId");
  let gameCategoryObjectId = asObjectId(input.gameCategoryId, "gameCategoryId");
  let gameTitle = input.gameTitle?.trim() ?? "";
  let genderCategory = parseGenderCategory(input.genderCategory);

  if (gameObjectId) {
    const game = await GameModel.findById(gameObjectId).lean();
    if (!game) throw new AppError("Game not found.", 404);
    if (!gameTitle) gameTitle = game.title;
    if (!gameCategoryObjectId && game.gameCategoryId) {
      gameCategoryObjectId = game.gameCategoryId as Types.ObjectId;
    }
    if (!genderCategory && game.genderCategory) {
      genderCategory = game.genderCategory;
    }
  }

  if (!gameTitle) {
    throw new AppError("Either gameId or gameTitle is required.", 400);
  }

  const playedAt = parseDate(input.playedAt, true)!;

  const created = await ResultModel.create({
    gameId: gameObjectId,
    gameTitle,
    gameCategoryId: gameCategoryObjectId,
    genderCategory,
    winnerDepartment,
    runnerUpDepartment,
    playedAt,
  });

  return { id: String(created._id) };
}

export async function updateResult(resultId: string, input: UpdateResultInput) {
  const id = asObjectId(resultId, "result id");
  if (!id) throw new AppError("Invalid result id.", 400);

  const result = await ResultModel.findById(id);
  if (!result) throw new AppError("Result not found.", 404);

  if (input.gameId !== undefined) {
    const gameObjectId = asObjectId(input.gameId, "gameId");
    if (gameObjectId) {
      const game = await GameModel.findById(gameObjectId).lean();
      if (!game) throw new AppError("Game not found.", 404);
      result.gameId = gameObjectId;
      if (!input.gameTitle) result.gameTitle = game.title;
      if (input.gameCategoryId === undefined && game.gameCategoryId) {
        result.gameCategoryId = game.gameCategoryId as Types.ObjectId;
      }
      if (input.genderCategory === undefined && game.genderCategory) {
        result.genderCategory = game.genderCategory;
      }
    }
  }

  if (input.gameTitle !== undefined && input.gameTitle.trim()) {
    result.gameTitle = input.gameTitle.trim();
  }
  if (input.gameCategoryId !== undefined) {
    result.gameCategoryId = asObjectId(input.gameCategoryId, "gameCategoryId");
  }
  if (input.genderCategory !== undefined) {
    result.genderCategory = parseGenderCategory(input.genderCategory);
  }
  if (input.winnerDepartment !== undefined) {
    result.winnerDepartment = sanitizeResultDepartment(
      input.winnerDepartment,
      "winnerDepartment",
    );
  }
  if (input.runnerUpDepartment !== undefined) {
    result.runnerUpDepartment = input.runnerUpDepartment.trim()
      ? sanitizeResultDepartment(input.runnerUpDepartment, "runnerUpDepartment")
      : undefined;
  }
  if (
    result.runnerUpDepartment &&
    result.runnerUpDepartment === result.winnerDepartment
  ) {
    throw new AppError("Runner-up cannot be the same as the winner.", 400);
  }
  if (input.playedAt !== undefined) {
    const playedAt = parseDate(input.playedAt);
    if (!playedAt) throw new AppError("playedAt must be a valid date.", 400);
    result.playedAt = playedAt;
  }

  await result.save();
  return { id: String(result._id) };
}

export async function deleteResult(resultId: string) {
  const id = asObjectId(resultId, "result id");
  if (!id) throw new AppError("Invalid result id.", 400);
  const removed = await ResultModel.deleteOne({ _id: id });
  if (removed.deletedCount === 0) {
    throw new AppError("Result not found.", 404);
  }
  return { deleted: true };
}

export async function listResults(params: ListResultsParams) {
  const query: Record<string, unknown> = {};
  if (params.gameId && Types.ObjectId.isValid(params.gameId)) {
    query.gameId = new Types.ObjectId(params.gameId);
  }
  if (params.gameCategoryId && Types.ObjectId.isValid(params.gameCategoryId)) {
    query.gameCategoryId = new Types.ObjectId(params.gameCategoryId);
  }
  if (params.gender) query.genderCategory = params.gender;
  if (params.department) {
    query.$or = [
      { winnerDepartment: params.department },
      { runnerUpDepartment: params.department },
    ];
  }
  if (params.from || params.to) {
    const range: Record<string, Date> = {};
    if (params.from) range.$gte = params.from;
    if (params.to) range.$lte = params.to;
    query.playedAt = range;
  }

  const limit = Math.min(500, Math.max(1, params.limit ?? 200));

  const rows = await ResultModel.find(query).sort({ playedAt: -1 }).limit(limit).lean();
  return rows.map((r) => ({
    _id: String(r._id),
    gameId: r.gameId ? String(r.gameId) : undefined,
    gameTitle: r.gameTitle,
    gameCategoryId: r.gameCategoryId ? String(r.gameCategoryId) : undefined,
    genderCategory: r.genderCategory,
    winnerDepartment: r.winnerDepartment,
    runnerUpDepartment: r.runnerUpDepartment,
    playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : r.playedAt,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

/**
 * Aggregated standings used by the student "Results" tab to render charts:
 * medalTable (gold = wins, silver = runner-ups), bySport medals, daily timeline,
 * and gender split. Filters share the same shape as `listResults` so the same
 * filter bar can drive both the cards view and the charts.
 */
export async function getStandings(params: ListResultsParams) {
  const query: Record<string, unknown> = {};
  if (params.gameCategoryId && Types.ObjectId.isValid(params.gameCategoryId)) {
    query.gameCategoryId = new Types.ObjectId(params.gameCategoryId);
  }
  if (params.gender) query.genderCategory = params.gender;
  if (params.from || params.to) {
    const range: Record<string, Date> = {};
    if (params.from) range.$gte = params.from;
    if (params.to) range.$lte = params.to;
    query.playedAt = range;
  }

  const results = await ResultModel.find(query).sort({ playedAt: 1 }).lean();

  const baseMedals = new Map<string, { gold: number; silver: number }>();
  for (const dept of SPORTS_WEEK_DEPARTMENTS) {
    baseMedals.set(dept, { gold: 0, silver: 0 });
  }

  const genderTitles = { male: 0, female: 0, mixed: 0 } as Record<GameGender, number>;
  const timelineByDate = new Map<string, { date: string; titles: number }>();

  type SportRow = { name: string; gold: number; silver: number };
  const sportRowsByCategoryId = new Map<string, SportRow>();

  const categoryIds = Array.from(
    new Set(
      results
        .map((r) => (r.gameCategoryId ? String(r.gameCategoryId) : null))
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const categoriesPopulated = categoryIds.length
    ? await GameCategoryModel.find({
        _id: { $in: categoryIds.map((c) => new Types.ObjectId(c)) },
      })
        .populate("sportId", "name slug")
        .lean()
    : [];
  const sportNameByCategoryId = new Map<string, string>();
  for (const c of categoriesPopulated) {
    const sport = c.sportId as unknown as { name?: string } | null;
    sportNameByCategoryId.set(String(c._id), sport?.name ?? c.name ?? "Other");
  }

  for (const r of results) {
    const winner = r.winnerDepartment;
    if (winner) {
      const prev = baseMedals.get(winner) ?? { gold: 0, silver: 0 };
      prev.gold += 1;
      baseMedals.set(winner, prev);
    }
    const runnerUp = r.runnerUpDepartment;
    if (runnerUp) {
      const prev = baseMedals.get(runnerUp) ?? { gold: 0, silver: 0 };
      prev.silver += 1;
      baseMedals.set(runnerUp, prev);
    }

    if (r.genderCategory) {
      genderTitles[r.genderCategory] += 1;
    }

    if (r.playedAt instanceof Date) {
      const key = r.playedAt.toISOString().slice(0, 10);
      const prev = timelineByDate.get(key) ?? { date: key, titles: 0 };
      prev.titles += 1;
      timelineByDate.set(key, prev);
    }

    if (r.gameCategoryId) {
      const cid = String(r.gameCategoryId);
      const sportName = sportNameByCategoryId.get(cid) ?? "Other";
      const prev = sportRowsByCategoryId.get(sportName) ?? {
        name: sportName,
        gold: 0,
        silver: 0,
      };
      if (r.winnerDepartment) prev.gold += 1;
      if (r.runnerUpDepartment) prev.silver += 1;
      sportRowsByCategoryId.set(sportName, prev);
    }
  }

  const medalTable = Array.from(baseMedals.entries())
    .map(([department, medals]) => ({
      department,
      gold: medals.gold,
      silver: medals.silver,
      total: medals.gold + medals.silver,
    }))
    .sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      return a.department.localeCompare(b.department);
    });

  const bySport = Array.from(sportRowsByCategoryId.values()).sort(
    (a, b) => b.gold + b.silver - (a.gold + a.silver),
  );

  const timeline = Array.from(timelineByDate.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  return {
    totalEvents: results.length,
    medalTable,
    bySport,
    byGender: genderTitles,
    timeline,
  };
}
