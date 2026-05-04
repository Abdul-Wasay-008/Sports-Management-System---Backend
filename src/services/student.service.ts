import type { HydratedDocument } from "mongoose";
import { Types } from "mongoose";
import { CommitteeMemberModel } from "../models/CommitteeMember.js";
import { DepartmentTeamManagerAssignmentModel } from "../models/DepartmentTeamManagerAssignment.js";
import { GameCategoryModel } from "../models/GameCategory.js";
import { GameManagerAssignmentModel } from "../models/GameManagerAssignment.js";
import { GameManagerModel } from "../models/GameManager.js";
import { DemoBookingModel } from "../models/DemoBooking.js";
import { GameModel } from "../models/Game.js";
import { NotificationModel } from "../models/Notification.js";
import { RegistrationModel, type RegistrationStatus } from "../models/Registration.js";
import { ResultModel } from "../models/Result.js";
import { RuleModel } from "../models/Rule.js";
import type { UserDocument } from "../models/User.js";
import { UserModel } from "../models/User.js";
import { type GameGender, type SportsWeekDepartment } from "../constants/sports-week.js";
import { getStandings as getResultsStandings } from "./results.service.js";
import { env } from "../config/env.js";
import {
  getDemoSlotsForWeek,
  getLatestCooldownEndsAt,
  parseWeekMondayFromQuery,
  registerForDemoSession,
  resolveDemoSchedulingContext,
} from "./demo-scheduling.service.js";
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
  from?: Date;
  to?: Date;
};

function assertEligible(studentGender: "male" | "female", gameGender: "male" | "female" | "mixed") {
  if (gameGender !== "mixed" && gameGender !== studentGender) {
    throw new AppError("You are not eligible for this game category.", 403);
  }
}

async function requireStudentUser(
  userId: string,
): Promise<
  HydratedDocument<UserDocument> & { gender: "male" | "female"; department: SportsWeekDepartment }
> {
  const user = await UserModel.findById(userId);
  if (!user) throw new AppError("Student not found.", 404);
  if (user.role !== "student") throw new AppError("Student not found.", 404);
  if (!user.gender || !user.department) {
    throw new AppError("Student profile is incomplete.", 400);
  }
  return user as HydratedDocument<UserDocument> & {
    gender: "male" | "female";
    department: SportsWeekDepartment;
  };
}

export async function getStudentDashboard(userId: string) {
  const student = await requireStudentUser(userId);

  const activeGames = await GameModel.countDocuments({
    isActive: true,
    genderCategory: { $in: [student.gender, "mixed"] },
  });
  const myRegistrations = await RegistrationModel.find({ studentId: student._id });
  const pending = myRegistrations.filter(
    (r) => r.status === "pending" || r.status === "demo_booked",
  ).length;
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

/**
 * Aggregates active (demo_booked + pending + accepted) and accepted-only
 * registration counts per `gameId` for a single department in one round-trip.
 * Both totals are needed downstream: the active count gates new bookings while
 * the accepted count drives the "available in your department" UI label.
 */
async function getDepartmentRegistrationCounts(
  gameIds: Types.ObjectId[],
  department: string,
): Promise<Map<string, { active: number; accepted: number }>> {
  if (gameIds.length === 0) return new Map();
  const rows = await RegistrationModel.aggregate<{
    _id: Types.ObjectId;
    active: number;
    accepted: number;
  }>([
    {
      $match: {
        gameId: { $in: gameIds },
        studentDepartment: department,
        status: { $in: ["demo_booked", "pending", "accepted"] },
      },
    },
    {
      $group: {
        _id: "$gameId",
        active: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
      },
    },
  ]);
  const out = new Map<string, { active: number; accepted: number }>();
  for (const row of rows) {
    out.set(String(row._id), { active: row.active, accepted: row.accepted });
  }
  return out;
}

export async function getEligibleGames(userId: string, filters: StudentQueryFilters = {}) {
  const student = await requireStudentUser(userId);

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

  const deptCounts = await getDepartmentRegistrationCounts(
    games.map((g) => g._id as Types.ObjectId),
    student.department,
  );

  return games
    .map((game) => {
      if (filters.department && filters.department !== student.department) return null;
      const manager = game.managerId as unknown as PopulatedManager | null;
      const policy = game.slotPolicy;
      const counts = deptCounts.get(String(game._id)) ?? { active: 0, accepted: 0 };
      const availableInMyDepartment = Math.max(0, policy.perDepartmentPlayers - counts.active);
      const globalAvailable = Math.max(0, game.totalSlots - game.acceptedRegistrations);
      return {
        id: String(game._id),
        title: game.title,
        slug: game.slug,
        description: game.description,
        venue: game.venue,
        genderCategory: game.genderCategory,
        totalSlots: game.totalSlots,
        acceptedRegistrations: game.acceptedRegistrations,
        availableSlots: globalAvailable,
        slotMode: policy.mode,
        perDepartmentPlayers: policy.perDepartmentPlayers,
        availableInMyDepartment,
        acceptedInMyDepartment: counts.accepted,
        registrationOpen: availableInMyDepartment > 0 && globalAvailable > 0,
        manager: manager
          ? {
              id: String(manager._id),
              name: manager.name,
            }
          : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function getGameDetails(userId: string, gameId: string) {
  const student = await requireStudentUser(userId);

  const game = await GameModel.findById(gameId).populate("managerId");
  if (!game || !game.isActive) throw new AppError("Game not found.", 404);
  assertEligible(student.gender, game.genderCategory);

  const schedulingCtx = await resolveDemoSchedulingContext(game, student.department);
  const schedulingConfigured = Boolean(schedulingCtx);

  const activeRegistration = await RegistrationModel.findOne({
    studentId: student._id,
    gameId: game._id,
    status: { $in: ["demo_booked", "pending", "accepted"] },
  })
    .sort({ createdAt: -1 })
    .populate("demoBookingId");

  const cooldownEndsAt = await getLatestCooldownEndsAt(student._id, game._id);

  const policy = game.slotPolicy;
  const deptCounts = await getDepartmentRegistrationCounts(
    [game._id as Types.ObjectId],
    student.department,
  );
  const counts = deptCounts.get(String(game._id)) ?? { active: 0, accepted: 0 };
  const availableInMyDepartment = Math.max(0, policy.perDepartmentPlayers - counts.active);

  const globalSlotsFull = game.acceptedRegistrations >= game.totalSlots;
  const departmentSlotsFull = availableInMyDepartment <= 0;
  const registrationOpen = !globalSlotsFull && !departmentSlotsFull;

  let blockReason: string | null = null;
  if (departmentSlotsFull) blockReason = "department_slots_full";
  else if (globalSlotsFull) blockReason = "slots_full";
  else if (!schedulingConfigured) blockReason = "no_team_manager";
  else if (activeRegistration) blockReason = "already_registered";
  else if (cooldownEndsAt) blockReason = "cooldown";

  const canRegisterForDemo =
    schedulingConfigured && registrationOpen && !activeRegistration && !cooldownEndsAt;

  const demoBookingDoc = activeRegistration?.demoBookingId as unknown as {
    startsAt: Date;
    endsAt: Date;
  } | null;

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
    slotMode: policy.mode,
    perDepartmentPlayers: policy.perDepartmentPlayers,
    availableInMyDepartment,
    acceptedInMyDepartment: counts.accepted,
    events: policy.events?.map((e) => ({ name: e.name, perDepartmentPlayers: e.perDepartmentPlayers })) ?? null,
    registrationOpen,
    registrationStatus: activeRegistration?.status ?? null,
    schedulingConfigured,
    scheduleTimezone: schedulingCtx?.timezone ?? env.demoScheduleTimezone,
    teamManagerContact: schedulingCtx
      ? {
          name: schedulingCtx.teamManagerName,
          contact: schedulingCtx.teamManagerContact,
        }
      : null,
    teamManagerMembers: schedulingCtx?.members ?? [],
    cooldownEndsAt: cooldownEndsAt?.toISOString() ?? null,
    canRegisterForDemo,
    blockReason,
    demo:
      activeRegistration?.status === "demo_booked" && demoBookingDoc
        ? {
            startsAt: demoBookingDoc.startsAt.toISOString(),
            endsAt: demoBookingDoc.endsAt.toISOString(),
          }
        : null,
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
  void userId;
  void gameId;
  throw new AppError(
    "Registration now requires booking a demo slot. Use POST /api/student/games/:id/register-demo with a selected startsAt time.",
    400,
  );
}

export async function getDemoSlotsForGame(userId: string, gameId: string, weekStart?: string) {
  const student = await requireStudentUser(userId);
  const game = await GameModel.findById(gameId);
  if (!game || !game.isActive) throw new AppError("Game not found.", 404);
  assertEligible(student.gender, game.genderCategory);

  const ctx = await resolveDemoSchedulingContext(game, student.department);
  if (!ctx) {
    throw new AppError(
      "Demo scheduling is not configured for this game or your department (category or team manager missing).",
      422,
    );
  }

  const monday = parseWeekMondayFromQuery(weekStart, ctx.timezone);
  return getDemoSlotsForWeek(ctx.assignmentId, monday, ctx.timezone);
}

export async function registerForDemo(userId: string, gameId: string, startsAt: string) {
  const student = await requireStudentUser(userId);
  return registerForDemoSession({
    student,
    gameId,
    startsAtIso: startsAt,
  });
}

export async function getMyRegistrations(userId: string, filters: StudentQueryFilters = {}) {
  const student = await requireStudentUser(userId);

  const registrations = await RegistrationModel.find({ studentId: student._id })
    .populate("gameId")
    .populate("demoBookingId")
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
    const demoBooking = row.demoBookingId as unknown as {
      startsAt: Date;
      endsAt: Date;
    } | null;
    return {
      id: String(row._id),
      status: row.status,
      decisionNote: row.decisionNote || null,
      decidedAt: row.decidedAt || null,
      createdAt: row.createdAt,
      demo:
        row.status === "demo_booked" && demoBooking
          ? {
              startsAt: demoBooking.startsAt.toISOString(),
              endsAt: demoBooking.endsAt.toISOString(),
            }
          : null,
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

/** Internal mutation used after authorization (admin or team manager). */
export async function decideRegistrationCore(
  registrationId: string,
  status: Extract<RegistrationStatus, "accepted" | "rejected">,
  note?: string,
) {
  const registration = await RegistrationModel.findById(registrationId);
  if (!registration) throw new AppError("Registration not found.", 404);
  if (registration.status !== "pending" && registration.status !== "demo_booked") {
    throw new AppError("Only registrations awaiting a decision (including booked demos) can be updated.", 400);
  }

  const priorStatus = registration.status;

  const game = await GameModel.findById(registration.gameId);
  if (!game) throw new AppError("Game not found for registration.", 404);

  if (status === "accepted" && game.acceptedRegistrations >= game.totalSlots) {
    throw new AppError("Cannot accept because game slots are full.", 400);
  }

  if (status === "accepted" && registration.studentDepartment) {
    /**
     * Hard cap from the manual: a department's accepted roster cannot grow
     * past `slotPolicy.perDepartmentPlayers`. Checked separately from the
     * global cap above so the team manager gets a clear, dept-specific error.
     */
    const acceptedInDept = await RegistrationModel.countDocuments({
      gameId: game._id,
      studentDepartment: registration.studentDepartment,
      status: "accepted",
    });
    if (acceptedInDept >= game.slotPolicy.perDepartmentPlayers) {
      const slotWord = game.slotPolicy.mode === "team" ? "roster slot" : "slot";
      throw new AppError(
        `Cannot accept: ${registration.studentDepartment} has already filled all ${game.slotPolicy.perDepartmentPlayers} ${slotWord}${game.slotPolicy.perDepartmentPlayers === 1 ? "" : "s"} for ${game.title}.`,
        400,
      );
    }
  }

  registration.status = status;
  registration.decisionNote = note?.trim() || undefined;
  registration.decidedAt = new Date();
  await registration.save();

  if (status === "accepted") {
    game.acceptedRegistrations += 1;
    await game.save();
  }

  const message =
    priorStatus === "demo_booked"
      ? status === "accepted"
        ? `After your demo, you were accepted for ${game.title}.`
        : `After your demo, you were not selected for ${game.title}. If rejected, you may apply again after the 10-day cooldown.`
      : `Your registration for ${game.title} was ${status}.`;

  await NotificationModel.create({
    studentId: registration.studentId,
    title: `Registration ${status}`,
    message,
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

export async function decideRegistrationAsActor(
  actor: { userId: string; role: "admin" | "team_manager" },
  registrationId: string,
  status: Extract<RegistrationStatus, "accepted" | "rejected">,
  note?: string,
) {
  if (actor.role === "team_manager") {
    if (!Types.ObjectId.isValid(registrationId)) {
      throw new AppError("Invalid registration id.", 400);
    }
    const regObjId = new Types.ObjectId(registrationId);
    const booking = await DemoBookingModel.findOne({ registrationId: regObjId }).lean();
    if (!booking) {
      throw new AppError(
        "You can only accept or reject registrations that have a booked demo for your assignments.",
        403,
      );
    }
    const assignment = await DepartmentTeamManagerAssignmentModel.findById(
      booking.departmentTeamManagerAssignmentId,
    ).lean();
    const isLinkedMember = (assignment?.members ?? []).some(
      (m) => m.linkedUserId && String(m.linkedUserId) === actor.userId,
    );
    if (!isLinkedMember) {
      throw new AppError("You are not responsible for this demo booking.", 403);
    }
    const registration = await RegistrationModel.findById(registrationId).lean();
    if (!registration || registration.status !== "demo_booked") {
      throw new AppError("This registration is not awaiting a demo decision.", 400);
    }
  }

  return decideRegistrationCore(registrationId, status, note);
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
  const student = await requireStudentUser(userId);

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
  const student = await requireStudentUser(userId);

  const resultQuery: Record<string, unknown> = {};
  if (filters.gender) resultQuery.genderCategory = filters.gender;
  if (filters.gameCategoryId && Types.ObjectId.isValid(filters.gameCategoryId)) {
    resultQuery.gameCategoryId = new Types.ObjectId(filters.gameCategoryId);
  }
  if (filters.gameId && Types.ObjectId.isValid(filters.gameId)) {
    resultQuery.gameId = new Types.ObjectId(filters.gameId);
  }
  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.$gte = filters.from;
    if (filters.to) range.$lte = filters.to;
    resultQuery.playedAt = range;
  }
  if (filters.department && filters.department !== student.department) return [];
  return ResultModel.find(resultQuery).sort({ playedAt: -1 });
}

export async function getStats(userId: string, filters: StudentQueryFilters = {}) {
  const student = await requireStudentUser(userId);
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
  const student = await requireStudentUser(userId);
  return NotificationModel.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(30);
}

export async function getDepartmentTeamManagers(userId: string, filters: StudentQueryFilters = {}) {
  const student = await requireStudentUser(userId);

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
      members: (row.members ?? []).map((m) => ({
        name: m.name,
        contact: m.contact ?? null,
      })),
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

/**
 * Personal stats used to power the "My activity" section of the student
 * Statistics tab: registration funnel, status breakdown, recent timeline,
 * sports tried vs available, and any active rejection cooldowns.
 */
export async function getMyStats(userId: string) {
  const student = await requireStudentUser(userId);

  const registrations = await RegistrationModel.find({ studentId: student._id })
    .populate("gameId")
    .populate("demoBookingId")
    .sort({ createdAt: 1 })
    .lean();

  let pending = 0;
  let demoBooked = 0;
  let accepted = 0;
  let rejected = 0;
  let cancelled = 0;
  let demoCompleted = 0;
  const triedCategoryIds = new Set<string>();
  const cooldowns: Array<{
    gameId: string;
    gameTitle: string;
    rejectedAt: string;
    cooldownEndsAt: string;
    daysRemaining: number;
  }> = [];

  type PopulatedGame = {
    _id: Types.ObjectId;
    title: string;
    gameCategoryId?: Types.ObjectId | null;
  };
  type PopulatedDemo = { startsAt: Date; endsAt: Date } | null;

  const COOLDOWN_DAYS = 10;
  const now = new Date();

  for (const reg of registrations) {
    if (reg.status === "pending") pending += 1;
    else if (reg.status === "demo_booked") demoBooked += 1;
    else if (reg.status === "accepted") accepted += 1;
    else if (reg.status === "rejected") rejected += 1;
    else if (reg.status === "cancelled") cancelled += 1;

    const demo = reg.demoBookingId as unknown as PopulatedDemo;
    if (demo && demo.endsAt instanceof Date && demo.endsAt.getTime() <= now.getTime()) {
      demoCompleted += 1;
    }

    const game = reg.gameId as unknown as PopulatedGame | null;
    if (game?.gameCategoryId) {
      triedCategoryIds.add(String(game.gameCategoryId));
    }

    if (reg.status === "rejected" && reg.decidedAt instanceof Date) {
      const cooldownEnds = new Date(
        reg.decidedAt.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
      );
      if (cooldownEnds.getTime() > now.getTime() && game) {
        const daysRemaining = Math.max(
          0,
          Math.ceil((cooldownEnds.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        );
        cooldowns.push({
          gameId: String(game._id),
          gameTitle: game.title,
          rejectedAt: reg.decidedAt.toISOString(),
          cooldownEndsAt: cooldownEnds.toISOString(),
          daysRemaining,
        });
      }
    }
  }

  const totalApplied = registrations.length;
  const totalDemoEverBooked = registrations.filter(
    (r) =>
      r.status === "demo_booked" ||
      r.status === "accepted" ||
      r.status === "rejected" ||
      r.status === "cancelled",
  ).length;
  const totalDecisions = accepted + rejected;

  const funnel = [
    { stage: "Applied", value: totalApplied },
    { stage: "Demo booked", value: totalDemoEverBooked },
    { stage: "Demo completed", value: demoCompleted },
    { stage: "Accepted", value: accepted },
  ];

  const statusBreakdown = {
    pending,
    demoBooked,
    accepted,
    rejected,
    cancelled,
  };

  const eligibleGames = await GameModel.find({
    isActive: true,
    genderCategory: { $in: [student.gender, "mixed"] },
  })
    .populate("gameCategoryId")
    .lean();

  const sportTriedSet = new Set<string>();
  const sportEligibleSet = new Set<string>();

  type PopulatedCategory = {
    _id: Types.ObjectId;
    name?: string;
    sportId?: Types.ObjectId | null;
  };

  const allSportNames = new Set<string>();
  const sportNameByCategoryId = new Map<string, string>();
  const allSportIds = new Set<string>();
  for (const g of eligibleGames) {
    const cat = g.gameCategoryId as unknown as PopulatedCategory | null;
    if (!cat) continue;
    if (cat.sportId) allSportIds.add(String(cat.sportId));
    sportNameByCategoryId.set(String(cat._id), cat.name ?? "Other");
  }

  const sportsList = allSportIds.size
    ? await (await import("../models/Sport.js")).SportModel.find({
        _id: { $in: Array.from(allSportIds).map((id) => new Types.ObjectId(id)) },
      }).lean()
    : [];
  const sportNameById = new Map<string, string>();
  for (const s of sportsList) {
    sportNameById.set(String(s._id), s.name);
    allSportNames.add(s.name);
  }

  for (const g of eligibleGames) {
    const cat = g.gameCategoryId as unknown as PopulatedCategory | null;
    if (!cat?.sportId) continue;
    const name = sportNameById.get(String(cat.sportId));
    if (name) sportEligibleSet.add(name);
  }

  for (const cid of triedCategoryIds) {
    const cat = await GameCategoryModel.findById(cid).populate("sportId", "name").lean();
    const sport = cat?.sportId as unknown as { name?: string } | null;
    if (sport?.name) {
      sportTriedSet.add(sport.name);
      allSportNames.add(sport.name);
    }
  }

  const sportsRadar = Array.from(allSportNames)
    .sort()
    .map((name) => ({
      sport: name,
      tried: sportTriedSet.has(name) ? 1 : 0,
      available: sportEligibleSet.has(name) ? 1 : 0,
    }));

  const timelineMap = new Map<string, { date: string; applications: number; decisions: number }>();
  for (const reg of registrations) {
    if (reg.createdAt instanceof Date) {
      const key = reg.createdAt.toISOString().slice(0, 10);
      const prev = timelineMap.get(key) ?? { date: key, applications: 0, decisions: 0 };
      prev.applications += 1;
      timelineMap.set(key, prev);
    }
    if (reg.decidedAt instanceof Date && (reg.status === "accepted" || reg.status === "rejected")) {
      const key = reg.decidedAt.toISOString().slice(0, 10);
      const prev = timelineMap.get(key) ?? { date: key, applications: 0, decisions: 0 };
      prev.decisions += 1;
      timelineMap.set(key, prev);
    }
  }
  const timeline = Array.from(timelineMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  return {
    summary: {
      totalApplied,
      accepted,
      rejected,
      pending: pending + demoBooked,
      cancelled,
      acceptRate: totalDecisions === 0 ? null : Math.round((accepted / totalDecisions) * 100),
    },
    funnel,
    statusBreakdown,
    sportsRadar,
    timeline,
    cooldowns,
  };
}

/**
 * Department-comparison data for charts on the student Statistics tab. Returns
 * per-game slot utilization across the student's eligible games and a gender
 * split scoped to the student's department.
 */
export async function getDepartmentTrends(userId: string) {
  const student = await requireStudentUser(userId);

  const games = await GameModel.find({
    isActive: true,
    genderCategory: { $in: [student.gender, "mixed"] },
  })
    .sort({ title: 1 })
    .lean();

  const slotUtilization = games.map((g) => ({
    gameId: String(g._id),
    title: g.title,
    genderCategory: g.genderCategory,
    totalSlots: g.totalSlots,
    accepted: g.acceptedRegistrations,
    available: Math.max(0, g.totalSlots - g.acceptedRegistrations),
    utilizationPct:
      g.totalSlots > 0 ? Math.round((g.acceptedRegistrations / g.totalSlots) * 100) : 0,
  }));

  const myDeptGenderSplit = await RegistrationModel.aggregate<{
    _id: "male" | "female";
    count: number;
  }>([
    {
      $match: {
        status: "accepted",
        studentDepartment: student.department,
        studentGender: { $in: ["male", "female"] },
      },
    },
    { $group: { _id: "$studentGender", count: { $sum: 1 } } },
  ]);
  const genderInDepartment = { male: 0, female: 0 };
  for (const row of myDeptGenderSplit) {
    if (row._id === "male") genderInDepartment.male = row.count;
    if (row._id === "female") genderInDepartment.female = row.count;
  }

  const demoToAcceptByGame = await RegistrationModel.aggregate<{
    _id: Types.ObjectId;
    demoStarted: number;
    accepted: number;
    rejected: number;
  }>([
    {
      $match: {
        status: { $in: ["demo_booked", "accepted", "rejected"] },
        studentGender: { $in: [student.gender, "mixed"] },
      },
    },
    {
      $group: {
        _id: "$gameId",
        demoStarted: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
      },
    },
  ]);

  const titleByGameId = new Map<string, string>();
  for (const g of games) titleByGameId.set(String(g._id), g.title);

  const demoToAccept = demoToAcceptByGame
    .filter((row) => titleByGameId.has(String(row._id)))
    .map((row) => {
      const decisions = row.accepted + row.rejected;
      return {
        gameId: String(row._id),
        title: titleByGameId.get(String(row._id)) ?? "Game",
        demoStarted: row.demoStarted,
        decisions,
        accepted: row.accepted,
        rejected: row.rejected,
        acceptRate: decisions === 0 ? 0 : Math.round((row.accepted / decisions) * 100),
      };
    })
    .sort((a, b) => b.demoStarted - a.demoStarted)
    .slice(0, 12);

  return {
    department: student.department,
    eligibleGenders: [student.gender, "mixed"] as const,
    slotUtilization,
    genderInDepartment,
    demoToAccept,
  };
}

type StandingsFilters = {
  gameCategoryId?: string;
  gender?: GameGender;
  from?: Date;
  to?: Date;
};

export async function getStudentResultsStandings(userId: string, filters: StandingsFilters) {
  await requireStudentUser(userId);
  return getResultsStandings({
    gameCategoryId: filters.gameCategoryId,
    gender: filters.gender,
    from: filters.from,
    to: filters.to,
  });
}
