import { Types } from "mongoose";
import { GameManagerModel } from "../models/GameManager.js";
import { GameModel } from "../models/Game.js";
import { NotificationModel } from "../models/Notification.js";
import { RegistrationModel, type RegistrationStatus } from "../models/Registration.js";
import { ResultModel } from "../models/Result.js";
import { RuleModel } from "../models/Rule.js";
import { UserModel } from "../models/User.js";
import { AppError } from "../utils/errors.js";

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
};

function assertEligible(studentGender: "male" | "female", gameGender: "male" | "female" | "mixed") {
  if (gameGender !== "mixed" && gameGender !== studentGender) {
    throw new AppError("You are not eligible for this game category.", 403);
  }
}

export async function getStudentDashboard(userId: string) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const activeGames = await GameModel.countDocuments({ isActive: true });
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

export async function getEligibleGames(userId: string) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const games = await GameModel.find({
    isActive: true,
    genderCategory: { $in: [student.gender, "mixed"] },
  })
    .populate("managerId")
    .sort({ title: 1 });

  return games.map((game) => {
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
  });
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

export async function getMyRegistrations(userId: string) {
  const student = await UserModel.findById(userId);
  if (!student) throw new AppError("Student not found.", 404);

  const registrations = await RegistrationModel.find({ studentId: student._id })
    .populate("gameId")
    .sort({ createdAt: -1 });

  return registrations.map((row) => {
    const game = row.gameId as unknown as PopulatedGame | null;
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
  });
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
  return [];
}

export async function getGameManagers() {
  return GameManagerModel.find().sort({ name: 1 });
}

export async function getResults() {
  return ResultModel.find().sort({ playedAt: -1 });
}

export async function getStats() {
  const byDepartment = await RegistrationModel.aggregate([
    { $match: { status: "accepted" } },
    {
      $lookup: {
        from: "users",
        localField: "studentId",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    { $group: { _id: "$student.department", value: { $sum: 1 } } },
    { $sort: { value: -1 } },
  ]);

  const byGame = await RegistrationModel.aggregate([
    { $match: { status: "accepted" } },
    {
      $lookup: {
        from: "games",
        localField: "gameId",
        foreignField: "_id",
        as: "game",
      },
    },
    { $unwind: "$game" },
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
