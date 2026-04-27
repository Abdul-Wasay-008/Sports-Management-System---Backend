import { Types } from "mongoose";
import { CommitteeMemberModel } from "../models/CommitteeMember.js";
import { DepartmentTeamManagerAssignmentModel } from "../models/DepartmentTeamManagerAssignment.js";
import { GameCategoryModel } from "../models/GameCategory.js";
import { GameManagerAssignmentModel } from "../models/GameManagerAssignment.js";
import { GameManagerModel } from "../models/GameManager.js";
import { GameModel } from "../models/Game.js";
import { NotificationModel } from "../models/Notification.js";
import { RegistrationModel, type RegistrationStatus } from "../models/Registration.js";
import { ResultModel } from "../models/Result.js";
import { RuleModel } from "../models/Rule.js";
import { UserModel } from "../models/User.js";
import { type GameGender, type SportsWeekDepartment } from "../constants/sports-week.js";
import { AppError } from "../utils/errors.js";

void GameManagerModel;

type PopulatedManager = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  officeAddress: string;
  officeHours: string;
};

type PopulatedGame = {
  _id: Types.ObjectId;
  title: string;
  venue: string;
  slug?: string;
  genderCategory?: "male" | "female" | "mixed";
};

type StudentQueryFilters = {
  department?: SportsWeekDepartment;
  gender?: GameGender;
  gameCategoryId?: string;
  gameId?: string;
};

function assertEligible(studentGender: "male" | "female", gameGender: "male" | "female" | "mixed") {
  if (gameGender !== "mixed" && gameGender !== studentGender) {
    throw new AppError("You are not eligible for this game category.", 403);
  }
}

export async function getStudentDashboard(userId: string) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const activeGames = await GameModel.countDocuments({
    isActive: true,
    genderCategory: { $in: [student.gender, "mixed"] },
  });
  const myRegistrations = await RegistrationModel.find({ studentId: student._id });
  const pending = myRegistrations.filter((r) => r.status === "pending").length;
  const accepted = myRegistrations.filter((r) => r.status === "accepted").length;
  const notifications = await NotificationModel.countDocuments({
    studentId: student._id,
    isRead: false,
  });

  return {
    student: {
      id: String(student._id),
      name: student.name,
      department: student.department,
      gender: student.gender,
      email: student.email,
    },
    summary: {
      activeGames,
      myRegistrations: myRegistrations.length,
      pendingApprovals: pending,
      acceptedRegistrations: accepted,
      unreadNotifications: notifications,
    },
  };
}

export async function getEligibleGames(userId: string, filters: StudentQueryFilters = {}) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const gameQuery: Record<string, unknown> = {
    isActive: true,
    genderCategory: { $in: [student.gender, "mixed"] },
  };

  if (filters.gender) {
    gameQuery.genderCategory =
      filters.gender === "mixed" ? "mixed" : { $in: [filters.gender, "mixed"] };
  }
  if (filters.gameId && Types.ObjectId.isValid(filters.gameId)) {
    gameQuery._id = new Types.ObjectId(filters.gameId);
  }
  if (filters.gameCategoryId && Types.ObjectId.isValid(filters.gameCategoryId)) {
    gameQuery.gameCategoryId = new Types.ObjectId(filters.gameCategoryId);
  }

  const games = await GameModel.find(gameQuery)
    .populate("managerId")
    .sort({ title: 1 });

  return games.map((game) => {
    if (filters.department && filters.department !== student.department) return null;
    const manager = game.managerId as unknown as PopulatedManager | null;
    return {
    id: String(game._id),
    title: game.title,
    slug: game.slug,
    description: game.description,
    venue: game.venue,
    genderCategory: game.genderCategory,
    totalSlots: game.totalSlots,
    acceptedRegistrations: game.acceptedRegistrations,
    availableSlots: Math.max(0, game.totalSlots - game.acceptedRegistrations),
    registrationOpen: game.acceptedRegistrations < game.totalSlots,
    manager: manager
      ? {
          id: String(manager._id),
          name: manager.name,
        }
      : null,
  };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function getGameDetails(userId: string, gameId: string) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const game = await GameModel.findById(gameId).populate("managerId");
  if (!game || !game.isActive) throw new AppError("Game not found.", 404);
  assertEligible(student.gender, game.genderCategory);

  const existingRegistration = await RegistrationModel.findOne({
    studentId: student._id,
    gameId: game._id,
  });

  return {
    id: String(game._id),
    title: game.title,
    description: game.description,
    venue: game.venue,
    rulesSummary: game.rulesSummary,
    genderCategory: game.genderCategory,
    totalSlots: game.totalSlots,
    acceptedRegistrations: game.acceptedRegistrations,
    availableSlots: Math.max(0, game.totalSlots - game.acceptedRegistrations),
    registrationOpen: game.acceptedRegistrations < game.totalSlots,
    registrationStatus: existingRegistration?.status ?? null,
    manager: (() => {
      const manager = game.managerId as unknown as PopulatedManager | null;
      if (!manager) return null;
      return {
        id: String(manager._id),
        name: manager.name,
        email: manager.email,
        phone: manager.phone,
        officeAddress: manager.officeAddress,
        officeHours: manager.officeHours,
      };
    })(),
  };
}

export async function registerForGame(userId: string, gameId: string) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const game = await GameModel.findById(gameId);
  if (!game || !game.isActive) throw new AppError("Game not found.", 404);
  assertEligible(student.gender, game.genderCategory);

  if (game.acceptedRegistrations >= game.totalSlots) {
    throw new AppError("Registration is closed because all slots are filled.", 400);
  }

  const existing = await RegistrationModel.findOne({ studentId: student._id, gameId: game._id });
  if (existing) {
    throw new AppError("You already have a registration request for this game.", 409);
  }

  const registration = await RegistrationModel.create({
    studentId: student._id,
    gameId: game._id,
    status: "pending",
    studentDepartment: student.department,
    studentGender: student.gender,
  });

  await NotificationModel.create({
    studentId: student._id,
    title: "Registration submitted",
    message: `Your request for ${game.title} is pending manager approval.`,
    category: "registration",
    isRead: false,
  });

  return {
    message: "Registration request submitted and pending manager approval.",
    registration: {
      id: String(registration._id),
      status: registration.status,
    },
  };
}

export async function getMyRegistrations(userId: string, filters: StudentQueryFilters = {}) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const registrations = await RegistrationModel.find({ studentId: student._id })
    .populate("gameId")
    .sort({ createdAt: -1 });

  return registrations.map((row) => {
    const game = row.gameId as unknown as PopulatedGame | null;
    if (filters.gender && game?.genderCategory) {
      const eligible =
        filters.gender === "mixed"
          ? game.genderCategory === "mixed"
          : [filters.gender, "mixed"].includes(game.genderCategory);
      if (!eligible) return null;
    }
    if (filters.gameId && game && String(game._id) !== filters.gameId) return null;
    if (filters.department && filters.department !== student.department) return null;
    return {
    id: String(row._id),
    status: row.status,
    decisionNote: row.decisionNote || null,
    decidedAt: row.decidedAt || null,
    createdAt: row.createdAt,
    game: game
      ? {
          id: String(game._id),
          title: game.title,
          venue: game.venue,
        }
      : null,
  };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function decideRegistration(
  registrationId: string,
  status: Extract<RegistrationStatus, "accepted" | "rejected">,
  note?: string,
) {
  const registration = await RegistrationModel.findById(registrationId);
  if (!registration) throw new AppError("Registration not found.", 404);
  if (registration.status !== "pending") {
    throw new AppError("Only pending requests can be decided.", 400);
  }

  const game = await GameModel.findById(registration.gameId);
  if (!game) throw new AppError("Game not found for registration.", 404);

  if (status === "accepted" && game.acceptedRegistrations >= game.totalSlots) {
    throw new AppError("Cannot accept because game slots are full.", 400);
  }

  registration.status = status;
  registration.decisionNote = note?.trim() || undefined;
  registration.decidedAt = new Date();
  await registration.save();

  if (status === "accepted") {
    game.acceptedRegistrations += 1;
    await game.save();
  }

  await NotificationModel.create({
    studentId: registration.studentId,
    title: `Registration ${status}`,
    message: `Your registration for ${game.title} was ${status}.`,
    category: "registration",
    isRead: false,
  });

  return {
    message: `Registration ${status} successfully.`,
    registration: {
      id: String(registration._id),
      status: registration.status,
      decidedAt: registration.decidedAt,
    },
  };
}

export async function getSchedule() {
  return [];
}

export async function getRules() {
  return RuleModel.find().sort({ createdAt: 1 });
}

export async function getCommittee() {
  const members = await CommitteeMemberModel.find({ committeeType: "core" }).sort({ order: 1 });
  return members.map((member) => ({
    _id: String(member._id),
    name: member.name,
    role: member.title,
    contact: "Sports Office",
  }));
}

export async function getGameManagers(userId: string, filters: StudentQueryFilters = {}) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const assignmentQuery: Record<string, unknown> = {};
  if (filters.gameCategoryId && Types.ObjectId.isValid(filters.gameCategoryId)) {
    assignmentQuery.gameCategoryId = new Types.ObjectId(filters.gameCategoryId);
  }

  const assignments = await GameManagerAssignmentModel.find(assignmentQuery)
    .populate("managerId")
    .populate("gameCategoryId")
    .sort({ createdAt: -1 });

  const allowedGender = filters.gender && filters.gender !== "mixed" ? filters.gender : student.gender;
  const filteredAssignments = assignments.filter((assignment) => {
    const category = assignment.gameCategoryId as unknown as { gender?: "male" | "female" | "mixed" } | null;
    if (!category?.gender) return false;
    return category.gender === "mixed" || category.gender === allowedGender;
  });

  return filteredAssignments.map((assignment) => {
    const manager = assignment.managerId as unknown as PopulatedManager | null;
    const category = assignment.gameCategoryId as unknown as {
      _id: Types.ObjectId;
      name: string;
      gender?: "male" | "female" | "mixed";
    } | null;
    return {
      _id: String(assignment._id),
      managerId: manager ? String(manager._id) : null,
      name: manager?.name ?? "Unknown manager",
      email: manager?.email ?? "",
      phone: manager?.phone ?? "",
      officeAddress: manager?.officeAddress ?? "",
      officeHours: manager?.officeHours ?? "",
      categoryId: category ? String(category._id) : null,
      categoryName: category?.name ?? "",
      categoryGender: category?.gender ?? null,
    };
  });
}

export async function getResults(userId: string, filters: StudentQueryFilters = {}) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const resultQuery: Record<string, unknown> = {};
  if (filters.gender) resultQuery.genderCategory = filters.gender;
  if (filters.gameCategoryId && Types.ObjectId.isValid(filters.gameCategoryId)) {
    resultQuery.gameCategoryId = new Types.ObjectId(filters.gameCategoryId);
  }
  if (filters.gameId && Types.ObjectId.isValid(filters.gameId)) {
    resultQuery.gameId = new Types.ObjectId(filters.gameId);
  }
  if (filters.department && filters.department !== student.department) return [];
  return ResultModel.find(resultQuery).sort({ playedAt: -1 });
}

export async function getStats(userId: string, filters: StudentQueryFilters = {}) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);
  if (filters.department && filters.department !== student.department) {
    return { byDepartment: [], byGame: [] };
  }

  const registrationMatch: Record<string, unknown> = { status: "accepted" };
  if (filters.gender) registrationMatch.studentGender = filters.gender;
  if (filters.department) registrationMatch.studentDepartment = filters.department;

  const byDepartment = await RegistrationModel.aggregate([
    { $match: registrationMatch },
    { $group: { _id: "$studentDepartment", value: { $sum: 1 } } },
    { $sort: { value: -1 } },
  ]);

  const gameMatchStages =
    filters.gameCategoryId && Types.ObjectId.isValid(filters.gameCategoryId)
      ? [{ $match: { "game.gameCategoryId": new Types.ObjectId(filters.gameCategoryId) } }]
      : [];

  const byGame = await RegistrationModel.aggregate([
    { $match: registrationMatch },
    {
      $lookup: {
        from: "games",
        localField: "gameId",
        foreignField: "_id",
        as: "game",
      },
    },
    { $unwind: "$game" },
    ...gameMatchStages,
    { $group: { _id: "$game.title", value: { $sum: 1 } } },
    { $sort: { value: -1 } },
  ]);

  return {
    byDepartment: byDepartment.map((row) => ({ label: row._id, value: row.value })),
    byGame: byGame.map((row) => ({ label: row._id, value: row.value })),
  };
}

export async function getNotifications(userId: string) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);
  return NotificationModel.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(30);
}

export async function getDepartmentTeamManagers(userId: string, filters: StudentQueryFilters = {}) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const query: Record<string, unknown> = {};
  query.department = filters.department ?? student.department;
  if (filters.gameCategoryId && Types.ObjectId.isValid(filters.gameCategoryId)) {
    query.gameCategoryId = new Types.ObjectId(filters.gameCategoryId);
  }

  const allowedGender = filters.gender && filters.gender !== "mixed" ? filters.gender : student.gender;
  const rows = await DepartmentTeamManagerAssignmentModel.find(query)
    .populate("gameCategoryId")
    .sort({ department: 1 });
  return rows.map((row) => {
    const category = row.gameCategoryId as unknown as {
      _id: Types.ObjectId;
      name: string;
      gender?: "male" | "female" | "mixed";
    } | null;
    if (!category?.gender || (category.gender !== "mixed" && category.gender !== allowedGender)) {
      return null;
    }
    return {
      _id: String(row._id),
      department: row.department,
      managerName: row.managerName,
      contact: row.contact ?? null,
      gameCategoryId: category ? String(category._id) : null,
      gameCategoryName: category?.name ?? "",
      gameCategoryGender: category?.gender ?? null,
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function getGameCategories() {
  const rows = await GameCategoryModel.find({ isActive: true }).sort({ name: 1 });
  return rows.map((row) => ({
    id: String(row._id),
    name: row.name,
    slug: row.slug,
    gender: row.gender,
  }));
}
