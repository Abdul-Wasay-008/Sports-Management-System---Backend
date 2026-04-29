import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { ADMIN_BOOTSTRAP } from "../config/admin.js";
import {
  SPORTS_WEEK_DEPARTMENTS,
  STUDENT_GENDERS,
  type SportsWeekDepartment,
  type StudentGender,
} from "../constants/sports-week.js";
import { CommitteeMemberModel } from "../models/CommitteeMember.js";
import { EmailOtpModel } from "../models/EmailOtp.js";
import { GameCategoryModel } from "../models/GameCategory.js";
import { GameManagerAssignmentModel } from "../models/GameManagerAssignment.js";
import { GameManagerModel } from "../models/GameManager.js";
import { GameModel } from "../models/Game.js";
import { NotificationModel } from "../models/Notification.js";
import { RegistrationModel } from "../models/Registration.js";
import { ResultModel } from "../models/Result.js";
import "../models/Sport.js";
import type { UserRole } from "../models/User.js";
import { UserModel } from "../models/User.js";
import { AppError } from "../utils/errors.js";
import {
  assertCustEmail,
  normalizeEmail,
  sanitizeDepartment,
  sanitizeRegistrationNumber,
  parseStudentGender,
} from "../utils/validators.js";

const PASSWORD_ROUNDS = 10;
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKeyError(err: unknown): err is { code: number } {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 11000);
}

export async function getOverview() {
  const [
    studentTotal,
    studentMale,
    studentFemale,
    studentActive,
    studentSuspended,
    gamesTotal,
    gamesMale,
    gamesFemale,
    gamesMixed,
    slotsAcceptedSum,
    registrationsTotal,
    regPending,
    regAccepted,
    regRejected,
    regCancelled,
    committeeTotal,
    managersTotal,
  ] = await Promise.all([
    UserModel.countDocuments({ role: "student" }),
    UserModel.countDocuments({ role: "student", gender: "male" }),
    UserModel.countDocuments({ role: "student", gender: "female" }),
    UserModel.countDocuments({ role: "student", status: "active" }),
    UserModel.countDocuments({ role: "student", status: "suspended" }),
    GameModel.countDocuments(),
    GameModel.countDocuments({ genderCategory: "male" }),
    GameModel.countDocuments({ genderCategory: "female" }),
    GameModel.countDocuments({ genderCategory: "mixed" }),
    GameModel.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$acceptedRegistrations" } } }]),
    RegistrationModel.countDocuments(),
    RegistrationModel.countDocuments({ status: "pending" }),
    RegistrationModel.countDocuments({ status: "accepted" }),
    RegistrationModel.countDocuments({ status: "rejected" }),
    RegistrationModel.countDocuments({ status: "cancelled" }),
    CommitteeMemberModel.countDocuments({ committeeType: "core" }),
    GameManagerModel.countDocuments(),
  ]);

  const totalAcceptedOnGames = slotsAcceptedSum[0]?.total ?? 0;

  return {
    students: {
      total: studentTotal,
      byGender: { male: studentMale, female: studentFemale },
      byStatus: { active: studentActive, suspended: studentSuspended },
    },
    games: {
      total: gamesTotal,
      byGender: { male: gamesMale, female: gamesFemale, mixed: gamesMixed },
      totalAcceptedRegistrations: totalAcceptedOnGames,
    },
    registrations: {
      total: registrationsTotal,
      byStatus: {
        pending: regPending,
        accepted: regAccepted,
        rejected: regRejected,
        cancelled: regCancelled,
      },
    },
    committee: { total: committeeTotal },
    gameManagers: { total: managersTotal },
  };
}

type ListStudentsParams = {
  search?: string;
  status?: "active" | "inactive" | "suspended";
  gender?: StudentGender;
  department?: SportsWeekDepartment;
  page?: number;
  limit?: number;
};

export async function listStudents(params: ListStudentsParams) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const match: Record<string, unknown> = { role: "student" as UserRole };
  if (params.status) match.status = params.status;
  if (params.gender) match.gender = params.gender;
  if (params.department) match.department = params.department;

  if (params.search?.trim()) {
    const term = escapeRegex(params.search.trim());
    match.$or = [
      { name: new RegExp(term, "i") },
      { email: new RegExp(term, "i") },
      { registrationNumber: new RegExp(term, "i") },
    ];
  }

  const [rows, total] = await Promise.all([
    UserModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "registrations",
          localField: "_id",
          foreignField: "studentId",
          as: "_regs",
        },
      },
      { $addFields: { registrationCount: { $size: "$_regs" } } },
      { $project: { passwordHash: 0, _regs: 0 } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    UserModel.countDocuments(match),
  ]);

  const students = rows.map((doc) => ({
    id: String(doc._id),
    name: doc.name as string,
    email: doc.email as string,
    registrationNumber: doc.registrationNumber as string,
    gender: doc.gender as StudentGender,
    department: doc.department as SportsWeekDepartment,
    status: doc.status as string,
    emailVerified: doc.emailVerified as boolean,
    registrationCount: doc.registrationCount as number,
    createdAt: doc.createdAt as Date,
  }));

  return { students, total, page, limit };
}

type CreateStudentInput = {
  name: string;
  email: string;
  registrationNumber: string;
  gender: StudentGender;
  /** Plain string from the request body; sanitized inside `createStudent`. */
  department: string;
  password: string;
};

export async function createStudent(input: CreateStudentInput) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  assertCustEmail(email);
  const registrationNumber = sanitizeRegistrationNumber(input.registrationNumber);
  const department = sanitizeDepartment(input.department);
  const password = input.password.trim();

  if (!name || !registrationNumber || !password) {
    throw new AppError("All required fields must be provided.", 400);
  }

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    throw new AppError(
      "Password must include at least one uppercase letter and one number (min 8 characters).",
      400,
    );
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);

  try {
    const user = await UserModel.create({
      name,
      email,
      registrationNumber,
      gender: input.gender,
      department,
      passwordHash,
      role: "student",
      status: "active",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      registrationNumber: user.registrationNumber,
      gender: user.gender,
      department: user.department,
      status: user.status,
      emailVerified: user.emailVerified,
    };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("Email or registration number is already in use.", 409);
    }
    throw err;
  }
}

type UpdateStudentInput = {
  name?: string;
  email?: string;
  registrationNumber?: string;
  gender?: StudentGender;
  department?: SportsWeekDepartment;
  status?: "active" | "inactive" | "suspended";
};

export async function updateStudent(studentId: string, input: UpdateStudentInput) {
  const user = await UserModel.findById(studentId);
  if (!user || user.role !== "student") {
    throw new AppError("Student not found.", 404);
  }

  if (input.name !== undefined) user.name = input.name.trim();
  if (input.gender !== undefined) user.gender = input.gender;
  if (input.status !== undefined) user.status = input.status;
  if (input.department !== undefined) user.department = sanitizeDepartment(input.department);

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    assertCustEmail(email);
    user.email = email;
  }

  if (input.registrationNumber !== undefined) {
    user.registrationNumber = sanitizeRegistrationNumber(input.registrationNumber);
  }

  try {
    await user.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("Email or registration number is already in use.", 409);
    }
    throw err;
  }

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    registrationNumber: user.registrationNumber,
    gender: user.gender,
    department: user.department,
    status: user.status,
    emailVerified: user.emailVerified,
  };
}

export async function setStudentStatus(actorId: string, studentId: string, status: "active" | "suspended") {
  if (actorId === studentId) {
    throw new AppError("You cannot change your own access status.", 400);
  }

  const user = await UserModel.findById(studentId);
  if (!user || user.role !== "student") {
    throw new AppError("Student not found.", 404);
  }

  user.status = status;
  await user.save();

  return {
    id: String(user._id),
    status: user.status,
  };
}

export async function hardDeleteStudent(actorId: string, studentId: string) {
  if (actorId === studentId) {
    throw new AppError("You cannot delete your own account.", 400);
  }

  const target = await UserModel.findById(studentId);
  if (!target) {
    throw new AppError("User not found.", 404);
  }

  if (target.role === "admin") {
    throw new AppError("Administrator accounts cannot be deleted.", 403);
  }

  if (normalizeEmail(target.email) === normalizeEmail(ADMIN_BOOTSTRAP.email)) {
    throw new AppError("This account cannot be deleted.", 403);
  }

  if (target.role !== "student") {
    throw new AppError("Only student accounts can be removed this way.", 400);
  }

  await RegistrationModel.deleteMany({ studentId: target._id });
  await NotificationModel.deleteMany({ studentId: target._id });
  await EmailOtpModel.deleteMany({ userId: target._id });
  await UserModel.deleteOne({ _id: target._id });

  return { deleted: true };
}

type ListGamesParams = {
  search?: string;
  gender?: string;
  sportId?: string;
};

export async function listGames(params: ListGamesParams) {
  const query: Record<string, unknown> = {};

  if (params.search?.trim()) {
    const term = escapeRegex(params.search.trim());
    query.$or = [{ title: new RegExp(term, "i") }, { slug: new RegExp(term, "i") }];
  }

  if (params.gender && ["male", "female", "mixed"].includes(params.gender)) {
    query.genderCategory = params.gender;
  }

  if (params.sportId && Types.ObjectId.isValid(params.sportId)) {
    const categories = await GameCategoryModel.find({
      sportId: new Types.ObjectId(params.sportId),
    })
      .select("_id")
      .lean();
    const ids = categories.map((c) => c._id);
    query.gameCategoryId = { $in: ids };
  }

  const games = await GameModel.find(query)
    .populate({
      path: "gameCategoryId",
      select: "name slug gender sportId",
      populate: { path: "sportId", select: "name slug" },
    })
    .populate("managerId", "name email phone officeAddress")
    .sort({ title: 1 })
    .lean();

  return {
    games: games.map((g) => ({
      id: String(g._id),
      title: g.title,
      slug: g.slug,
      description: g.description,
      genderCategory: g.genderCategory,
      venue: g.venue,
      rulesSummary: g.rulesSummary,
      totalSlots: g.totalSlots,
      acceptedRegistrations: g.acceptedRegistrations,
      isActive: g.isActive,
      managerId: g.managerId ? String((g.managerId as { _id: Types.ObjectId })._id) : undefined,
      manager: g.managerId,
      gameCategoryId: g.gameCategoryId ? String((g.gameCategoryId as { _id: Types.ObjectId })._id) : undefined,
      category: g.gameCategoryId,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    })),
  };
}

type CreateGameInput = {
  title: string;
  slug: string;
  description: string;
  genderCategory: "male" | "female" | "mixed";
  venue: string;
  rulesSummary: string;
  totalSlots: number;
  managerId: string;
  gameCategoryId: string;
  isActive?: boolean;
};

export async function createGame(input: CreateGameInput) {
  const slug = input.slug.trim().toLowerCase();
  const title = input.title.trim();

  const allowedGender = ["male", "female", "mixed"] as const;
  if (!allowedGender.includes(input.genderCategory)) {
    throw new AppError("genderCategory must be male, female, or mixed.", 400);
  }

  if (!title || !slug || !input.description.trim() || !input.venue.trim() || !input.rulesSummary.trim()) {
    throw new AppError("All game fields are required.", 400);
  }

  if (!Types.ObjectId.isValid(input.managerId) || !Types.ObjectId.isValid(input.gameCategoryId)) {
    throw new AppError("Invalid manager or category reference.", 400);
  }

  const category = await GameCategoryModel.findById(input.gameCategoryId);
  if (!category || !category.isActive) {
    throw new AppError("Game category not found or inactive.", 404);
  }

  const manager = await GameManagerModel.findById(input.managerId);
  if (!manager) {
    throw new AppError("Game manager not found.", 404);
  }

  const totalSlots = Number(input.totalSlots);
  if (!Number.isFinite(totalSlots) || totalSlots < 1) {
    throw new AppError("totalSlots must be at least 1.", 400);
  }

  try {
    const game = await GameModel.create({
      title,
      slug,
      description: input.description.trim(),
      genderCategory: input.genderCategory,
      venue: input.venue.trim(),
      rulesSummary: input.rulesSummary.trim(),
      totalSlots,
      acceptedRegistrations: 0,
      managerId: input.managerId,
      gameCategoryId: input.gameCategoryId,
      isActive: input.isActive ?? true,
    });

    return { id: String(game._id) };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("A game with this slug already exists.", 409);
    }
    throw err;
  }
}

type UpdateGameInput = Partial<{
  title: string;
  slug: string;
  description: string;
  genderCategory: "male" | "female" | "mixed";
  venue: string;
  rulesSummary: string;
  totalSlots: number;
  managerId: string;
  gameCategoryId: string;
  isActive: boolean;
}>;

export async function updateGame(gameId: string, input: UpdateGameInput) {
  const game = await GameModel.findById(gameId);
  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  if (input.title !== undefined) game.title = input.title.trim();
  if (input.description !== undefined) game.description = input.description.trim();
  if (input.venue !== undefined) game.venue = input.venue.trim();
  if (input.rulesSummary !== undefined) game.rulesSummary = input.rulesSummary.trim();
  if (input.genderCategory !== undefined) game.genderCategory = input.genderCategory;
  if (input.isActive !== undefined) game.isActive = input.isActive;

  if (input.slug !== undefined) {
    game.slug = input.slug.trim().toLowerCase();
  }

  if (input.totalSlots !== undefined) {
    const next = Number(input.totalSlots);
    if (!Number.isFinite(next) || next < 1) {
      throw new AppError("totalSlots must be at least 1.", 400);
    }
    if (next < game.acceptedRegistrations) {
      throw new AppError(
        `totalSlots cannot be less than accepted registrations (${game.acceptedRegistrations}).`,
        400,
      );
    }
    game.totalSlots = next;
  }

  if (input.managerId !== undefined) {
    if (!Types.ObjectId.isValid(input.managerId)) {
      throw new AppError("Invalid manager reference.", 400);
    }
    const manager = await GameManagerModel.findById(input.managerId);
    if (!manager) throw new AppError("Game manager not found.", 404);
    game.managerId = new Types.ObjectId(input.managerId);
  }

  if (input.gameCategoryId !== undefined) {
    if (!Types.ObjectId.isValid(input.gameCategoryId)) {
      throw new AppError("Invalid category reference.", 400);
    }
    const category = await GameCategoryModel.findById(input.gameCategoryId);
    if (!category || !category.isActive) {
      throw new AppError("Game category not found or inactive.", 404);
    }
    game.gameCategoryId = new Types.ObjectId(input.gameCategoryId);
  }

  try {
    await game.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("A game with this slug already exists.", 409);
    }
    throw err;
  }

  return { id: String(game._id) };
}

export async function deleteGame(gameId: string) {
  const game = await GameModel.findById(gameId);
  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  const blocking = await RegistrationModel.countDocuments({
    gameId: game._id,
    status: { $in: ["pending", "accepted", "rejected"] },
  });

  if (blocking > 0) {
    throw new AppError(
      "This game has active registrations. Cancel or resolve them before deleting the game.",
      400,
    );
  }

  await RegistrationModel.deleteMany({ gameId: game._id });
  await ResultModel.deleteMany({ gameId: game._id });

  if (game.gameCategoryId) {
    const others = await GameModel.countDocuments({
      gameCategoryId: game.gameCategoryId,
      _id: { $ne: game._id },
    });
    if (others === 0) {
      await GameManagerAssignmentModel.deleteMany({ gameCategoryId: game.gameCategoryId });
    }
  }

  await GameModel.deleteOne({ _id: game._id });

  return { deleted: true };
}

type ListRegsParams = {
  status?: string;
};

export async function listGameRegistrations(gameId: string, params: ListRegsParams) {
  if (!Types.ObjectId.isValid(gameId)) {
    throw new AppError("Invalid game id.", 400);
  }

  const game = await GameModel.findById(gameId).select("title slug").lean();
  if (!game) {
    throw new AppError("Game not found.", 404);
  }

  const match: Record<string, unknown> = { gameId: new Types.ObjectId(gameId) };
  if (params.status && ["pending", "accepted", "rejected", "cancelled"].includes(params.status)) {
    match.status = params.status;
  }

  const rows = await RegistrationModel.find(match)
    .populate("studentId", "name email registrationNumber gender department")
    .sort({ createdAt: -1 })
    .lean();

  return {
    game: { id: String(game._id), title: game.title, slug: game.slug },
    registrations: rows.map((r) => {
      const student = r.studentId as unknown as {
        _id: Types.ObjectId;
        name: string;
        email: string;
        registrationNumber: string;
        gender: string;
        department: string;
      } | null;

      return {
        id: String(r._id),
        status: r.status,
        decisionNote: r.decisionNote,
        decidedAt: r.decidedAt,
        createdAt: r.createdAt,
        student: student
          ? {
              id: String(student._id),
              name: student.name,
              email: student.email,
              registrationNumber: student.registrationNumber,
              gender: student.gender,
              department: student.department,
            }
          : null,
      };
    }),
  };
}

export async function getStats() {
  const acceptedGender = await RegistrationModel.aggregate<{ _id: string; count: number }>([
    { $match: { status: "accepted", studentGender: { $in: STUDENT_GENDERS } } },
    { $group: { _id: "$studentGender", count: { $sum: 1 } } },
  ]);

  const byGender = { male: 0, female: 0 };
  for (const row of acceptedGender) {
    if (row._id === "male") byGender.male = row.count;
    if (row._id === "female") byGender.female = row.count;
  }

  const byGame = await RegistrationModel.aggregate<{
    _id: Types.ObjectId;
    pending: number;
    accepted: number;
    rejected: number;
  }>([
    {
      $group: {
        _id: "$gameId",
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
      },
    },
  ]);

  const gameIds = byGame.map((g) => g._id).filter(Boolean);
  const games = await GameModel.find({ _id: { $in: gameIds } })
    .select("title genderCategory")
    .lean();
  const gameMeta = new Map<string, { title: string; genderCategory: string }>();
  for (const g of games) {
    gameMeta.set(String(g._id), { title: g.title, genderCategory: g.genderCategory });
  }

  const byGameOut = byGame.map((row) => {
    const meta = gameMeta.get(String(row._id));
    return {
      gameId: String(row._id),
      title: meta?.title ?? "Unknown game",
      gender: meta?.genderCategory ?? "mixed",
      pending: row.pending,
      accepted: row.accepted,
      rejected: row.rejected,
    };
  });

  const byDepartment = await RegistrationModel.aggregate<{ _id: string; count: number }>([
    { $match: { status: "accepted", studentDepartment: { $exists: true, $ne: null } } },
    { $group: { _id: "$studentDepartment", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return {
    byGender,
    byGame: byGameOut.sort((a, b) => b.accepted + b.pending - (a.accepted + a.pending)),
    byDepartment: byDepartment.map((d) => ({
      department: d._id,
      accepted: d.count,
    })),
  };
}

export async function getLookups() {
  const [categories, managers] = await Promise.all([
    GameCategoryModel.find({ isActive: true })
      .populate("sportId", "name slug")
      .sort({ name: 1 })
      .lean(),
    GameManagerModel.find().sort({ name: 1 }).lean(),
  ]);

  return {
    departments: [...SPORTS_WEEK_DEPARTMENTS],
    categories: categories.map((c) => ({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      gender: c.gender,
      sport: c.sportId,
    })),
    managers: managers.map((m) => ({
      id: String(m._id),
      name: m.name,
      email: m.email,
      phone: m.phone,
    })),
  };
}
