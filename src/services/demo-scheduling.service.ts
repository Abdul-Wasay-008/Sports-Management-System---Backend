import { DateTime } from "luxon";
import type { Types } from "mongoose";
import {
  DEMO_BUSINESS_END_HOUR,
  DEMO_BUSINESS_START_HOUR,
  DEMO_COOLDOWN_MS,
  DEMO_SLOT_MINUTES,
} from "../constants/demo-scheduling.js";
import { env } from "../config/env.js";
import { DepartmentTeamManagerAssignmentModel } from "../models/DepartmentTeamManagerAssignment.js";
import { DemoBookingModel } from "../models/DemoBooking.js";
import { TeamManagerNotificationModel } from "../models/TeamManagerNotification.js";
import { GameModel } from "../models/Game.js";
import { NotificationModel } from "../models/Notification.js";
import { RegistrationModel } from "../models/Registration.js";
import type { UserDocument } from "../models/User.js";
import type { SportsWeekDepartment } from "../constants/sports-week.js";
import { AppError } from "../utils/errors.js";

const ACTIVE_REGISTRATION_STATUSES = ["demo_booked", "pending", "accepted"] as const;

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(
    err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 11000,
  );
}

export type DemoSchedulingContextMember = {
  name: string;
  contact: string | null;
};

export type DemoSchedulingContext = {
  timezone: string;
  assignmentId: Types.ObjectId;
  teamManagerName: string;
  teamManagerContact: string | null;
  members: DemoSchedulingContextMember[];
};

function mondayStartOfWeekContaining(dt: DateTime): DateTime {
  const day = dt.startOf("day");
  const weekday = day.weekday;
  return day.minus({ days: weekday - 1 });
}

export function generateSlotStartsForDay(day: DateTime, timezone: string): DateTime[] {
  const d = day.setZone(timezone).startOf("day");
  const slots: DateTime[] = [];
  let t = d.set({ hour: DEMO_BUSINESS_START_HOUR, minute: 0, second: 0, millisecond: 0 });
  const endOfBusiness = d.set({ hour: DEMO_BUSINESS_END_HOUR, minute: 0, second: 0, millisecond: 0 });
  while (t.plus({ minutes: DEMO_SLOT_MINUTES }) <= endOfBusiness) {
    slots.push(t);
    t = t.plus({ minutes: DEMO_SLOT_MINUTES });
  }
  return slots;
}

function isWeekday(dt: DateTime): boolean {
  const wd = dt.weekday;
  return wd >= 1 && wd <= 5;
}

export function generateSlotsForWeekRange(
  weekMonday: DateTime,
  timezone: string,
): Array<{ startsAt: DateTime; endsAt: DateTime }> {
  const monday = weekMonday.setZone(timezone).startOf("day");
  const out: Array<{ startsAt: DateTime; endsAt: DateTime }> = [];
  for (let i = 0; i < 7; i++) {
    const day = monday.plus({ days: i });
    if (!isWeekday(day)) continue;
    for (const start of generateSlotStartsForDay(day, timezone)) {
      out.push({
        startsAt: start,
        endsAt: start.plus({ minutes: DEMO_SLOT_MINUTES }),
      });
    }
  }
  return out;
}

export async function resolveDemoSchedulingContext(
  game: { _id: Types.ObjectId; gameCategoryId?: Types.ObjectId | null },
  studentDepartment: SportsWeekDepartment,
): Promise<DemoSchedulingContext | null> {
  if (!game.gameCategoryId) return null;

  const assignment = await DepartmentTeamManagerAssignmentModel.findOne({
    gameCategoryId: game.gameCategoryId,
    department: studentDepartment,
  }).lean();

  if (!assignment) return null;

  const rawMembers = Array.isArray(assignment.members) ? assignment.members : [];
  const members: DemoSchedulingContextMember[] = rawMembers
    .map((m) => ({
      name: (m.name ?? "").trim(),
      contact: m.contact?.trim() ? m.contact.trim() : null,
    }))
    .filter((m) => m.name.length > 0);

  /**
   * Demo bookings are only allowed if at least one named member of this cell has
   * a linked team-manager User account who can later accept/reject. Cells that
   * are present in the manual but unstaffed (no `members[]`) or staffed only by
   * names that did not produce a User (shouldn't happen via the seed, but guard
   * anyway) are reported as "not configured" so the UI hides the booking button
   * and the booking endpoint returns a clear error.
   */
  const hasLinkedMember = rawMembers.some((m) => Boolean(m.linkedUserId));
  if (!hasLinkedMember) return null;

  return {
    timezone: env.demoScheduleTimezone,
    assignmentId: assignment._id,
    teamManagerName: assignment.managerName,
    teamManagerContact: assignment.contact?.trim() ? assignment.contact.trim() : null,
    members,
  };
}

export async function getLatestCooldownEndsAt(
  studentId: Types.ObjectId,
  gameId: Types.ObjectId,
): Promise<Date | null> {
  const lastRejected = await RegistrationModel.findOne({
    studentId,
    gameId,
    status: "rejected",
    decidedAt: { $exists: true, $ne: null },
  })
    .sort({ decidedAt: -1 })
    .lean();

  if (!lastRejected?.decidedAt) return null;
  const ends = new Date(lastRejected.decidedAt.getTime() + DEMO_COOLDOWN_MS);
  return ends > new Date() ? ends : null;
}

export async function assertCanStartDemoRegistration(
  studentId: Types.ObjectId,
  gameId: Types.ObjectId,
) {
  const blocking = await RegistrationModel.findOne({
    studentId,
    gameId,
    status: { $in: ACTIVE_REGISTRATION_STATUSES },
  }).lean();

  if (blocking) {
    throw new AppError("You already have an active registration for this game.", 409);
  }

  const cooldownEnds = await getLatestCooldownEndsAt(studentId, gameId);
  if (cooldownEnds) {
    throw new AppError(
      `You can apply again after ${cooldownEnds.toISOString()} (10-day cooldown after rejection).`,
      429,
    );
  }
}

export function parseWeekMondayFromQuery(weekStartParam: string | undefined, timezone: string): DateTime {
  const now = DateTime.now().setZone(timezone);
  if (!weekStartParam?.trim()) {
    return mondayStartOfWeekContaining(now);
  }
  const parsed = DateTime.fromISO(weekStartParam.trim(), { zone: timezone });
  if (!parsed.isValid) {
    throw new AppError("Invalid weekStart date.", 400);
  }
  return mondayStartOfWeekContaining(parsed.startOf("day"));
}

export async function getDemoSlotsForWeek(
  assignmentId: Types.ObjectId,
  weekMonday: DateTime,
  timezone: string,
) {
  const monday = weekMonday.setZone(timezone).startOf("day");
  const sundayEnd = monday.plus({ days: 7 });

  const bookings = await DemoBookingModel.find({
    departmentTeamManagerAssignmentId: assignmentId,
    startsAt: { $gte: monday.toUTC().toJSDate(), $lt: sundayEnd.toUTC().toJSDate() },
  })
    .select("startsAt endsAt")
    .lean();

  const bookedStarts = new Set(bookings.map((b) => new Date(b.startsAt).toISOString()));

  const slots = generateSlotsForWeekRange(monday, timezone).map(({ startsAt, endsAt }) => ({
    startsAt: startsAt.toUTC().toISO()!,
    endsAt: endsAt.toUTC().toISO()!,
    status: bookedStarts.has(startsAt.toUTC().toJSDate().toISOString())
      ? ("booked" as const)
      : ("free" as const),
  }));

  return {
    weekStart: monday.toISODate()!,
    timezone,
    slots,
  };
}

function maxBookableInstant(timezone: string): DateTime {
  const weeks = Math.max(1, env.demoScheduleHorizonWeeks);
  return DateTime.now().setZone(timezone).plus({ weeks }).endOf("day");
}

export function assertSlotIsValidForBooking(
  startsAtUtc: Date,
  timezone: string,
): { startsLuxon: DateTime; endsLuxon: DateTime } {
  const startsLuxon = DateTime.fromJSDate(startsAtUtc, { zone: "utc" }).setZone(timezone);

  if (!isWeekday(startsLuxon)) {
    throw new AppError("Demo slots are only available Monday through Friday.", 400);
  }

  const daySlots = generateSlotStartsForDay(startsLuxon, timezone);
  const match = daySlots.find((s) => Math.abs(s.toMillis() - startsLuxon.toMillis()) < 1000);
  if (!match) {
    throw new AppError("Selected time does not match an available demo slot.", 400);
  }

  const endsLuxon = match.plus({ minutes: DEMO_SLOT_MINUTES });
  const businessEnd = startsLuxon.startOf("day").set({
    hour: DEMO_BUSINESS_END_HOUR,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  if (endsLuxon > businessEnd) {
    throw new AppError("Selected slot exceeds allowed business hours.", 400);
  }

  const nowTz = DateTime.now().setZone(timezone);
  const minStart = nowTz.plus({ minutes: env.demoMinimumNoticeMinutes });
  if (startsLuxon < minStart) {
    throw new AppError(
      `Demo must be at least ${env.demoMinimumNoticeMinutes} minutes from now.`,
      400,
    );
  }

  if (startsLuxon > maxBookableInstant(timezone)) {
    throw new AppError("Selected slot is outside the booking window.", 400);
  }

  return { startsLuxon: match, endsLuxon };
}

export async function registerForDemoSession(params: {
  student: UserDocument & { _id: Types.ObjectId; gender: "male" | "female"; department: SportsWeekDepartment };
  gameId: string;
  startsAtIso: string;
}) {
  const { student, gameId, startsAtIso } = params;

  const game = await GameModel.findById(gameId);
  if (!game || !game.isActive) throw new AppError("Game not found.", 404);

  if (game.genderCategory !== "mixed" && game.genderCategory !== student.gender) {
    throw new AppError("You are not eligible for this game category.", 403);
  }

  if (game.acceptedRegistrations >= game.totalSlots) {
    throw new AppError("Registration is closed because all slots are filled.", 400);
  }

  /**
   * Per-(game × department) cap from the manual. Counts every "in-flight"
   * registration (booked demos + pending decisions + already accepted) so a
   * single department cannot queue past its team / individual cap. The
   * existing global `totalSlots` check above remains as an upper bound.
   */
  const perDepartmentCap = game.slotPolicy.perDepartmentPlayers;
  const activeInDept = await RegistrationModel.countDocuments({
    gameId: game._id,
    studentDepartment: student.department,
    status: { $in: ["demo_booked", "pending", "accepted"] },
  });
  if (activeInDept >= perDepartmentCap) {
    const slotWord = game.slotPolicy.mode === "team" ? "roster slot" : "slot";
    throw new AppError(
      `Your department (${student.department}) has filled all ${perDepartmentCap} ${slotWord}${perDepartmentCap === 1 ? "" : "s"} for ${game.title}.`,
      400,
    );
  }

  const ctx = await resolveDemoSchedulingContext(game, student.department);
  if (!ctx) {
    throw new AppError(
      "Demo scheduling is not configured for this game or your department (category or team manager missing).",
      422,
    );
  }

  await assertCanStartDemoRegistration(student._id, game._id);

  const startsParsed = DateTime.fromISO(startsAtIso.trim(), { zone: "utc" });
  if (!startsParsed.isValid) {
    throw new AppError("Invalid startsAt datetime.", 400);
  }
  const startsUtc = startsParsed.toUTC().toJSDate();

  const { startsLuxon, endsLuxon } = assertSlotIsValidForBooking(startsUtc, ctx.timezone);

  const startsAtDb = startsLuxon.toUTC().toJSDate();
  const endsAtDb = endsLuxon.toUTC().toJSDate();
  const slotLabel = startsLuxon.setZone(ctx.timezone).toFormat("ccc dd LLL yyyy, HH:mm");

  /** Sequential writes: standalone MongoDB does not support multi-document transactions. */
  const registration = await RegistrationModel.create({
    studentId: student._id,
    gameId: game._id,
    status: "demo_booked",
    studentDepartment: student.department,
    studentGender: student.gender,
  });

  let createdBooking: { _id: Types.ObjectId } | null = null;
  try {
    const booking = await DemoBookingModel.create({
      departmentTeamManagerAssignmentId: ctx.assignmentId,
      gameId: game._id,
      studentId: student._id,
      registrationId: registration._id,
      startsAt: startsAtDb,
      endsAt: endsAtDb,
    });

    createdBooking = booking;
    registration.demoBookingId = booking._id;
    await registration.save();
  } catch (err: unknown) {
    await RegistrationModel.deleteOne({ _id: registration._id }).catch(() => {});
    if (isDuplicateKeyError(err)) {
      throw new AppError("That time slot was just taken. Please choose another.", 409);
    }
    throw err;
  }

  if (createdBooking) {
    try {
      const assignmentDoc = await DepartmentTeamManagerAssignmentModel.findById(ctx.assignmentId).lean();
      const recipients = (assignmentDoc?.members ?? [])
        .map((m) => m.linkedUserId)
        .filter((id): id is Types.ObjectId => Boolean(id));

      if (recipients.length > 0) {
        await TeamManagerNotificationModel.insertMany(
          recipients.map((teamManagerUserId) => ({
            teamManagerUserId,
            title: "New demo request",
            message: `${student.name} (${student.department}) booked a demo for ${game.title} on ${slotLabel} (${ctx.timezone}).`,
            registrationId: registration._id,
            demoBookingId: createdBooking!._id,
            isRead: false,
          })),
        );
      }
    } catch (tmNotifyErr) {
      console.error("[demo-booking] Team manager notification failed:", tmNotifyErr);
    }
  }

  try {
    await NotificationModel.create({
      studentId: student._id,
      title: "Demo booked",
      message: `Your demo for ${game.title} is scheduled for ${slotLabel} (${ctx.timezone}).`,
      category: "registration",
      isRead: false,
    });
  } catch (notifyErr) {
    console.error("[demo-booking] Notification insert failed after successful booking:", notifyErr);
  }

  return {
    message:
      "Demo booked successfully. Attend at the scheduled time; your team manager will confirm selection afterward.",
    registration: {
      id: String(registration._id),
      status: "demo_booked",
    },
    demo: {
      startsAt: startsAtDb.toISOString(),
      endsAt: endsAtDb.toISOString(),
      timezone: ctx.timezone,
    },
  };
}
