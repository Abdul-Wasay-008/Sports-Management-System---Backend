import { Types } from "mongoose";
import { DemoBookingModel } from "../models/DemoBooking.js";
import { DepartmentTeamManagerAssignmentModel } from "../models/DepartmentTeamManagerAssignment.js";
import { GameModel } from "../models/Game.js";
import { RegistrationModel } from "../models/Registration.js";
import { TeamManagerNotificationModel } from "../models/TeamManagerNotification.js";
import { UserModel } from "../models/User.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

export async function requireTeamManagerUser(userId: string) {
  const user = await UserModel.findById(userId).select("_id role status").lean();
  if (!user || user.role !== "team_manager" || user.status !== "active") {
    throw new AppError("Team manager access required.", 403);
  }
  return user;
}

export async function getTeamManagerDashboard(tmUserId: string) {
  await requireTeamManagerUser(tmUserId);
  const tmOid = new Types.ObjectId(tmUserId);

  const assignmentIds = await DepartmentTeamManagerAssignmentModel.find({ linkedUserId: tmOid })
    .select("_id")
    .lean();
  const ids = assignmentIds.map((a) => a._id);

  let pendingDemoCount = 0;
  if (ids.length) {
    const bookings = await DemoBookingModel.find({
      departmentTeamManagerAssignmentId: { $in: ids },
    })
      .select("registrationId")
      .lean();
    const regIds = bookings.map((b) => b.registrationId).filter(Boolean);
    if (regIds.length) {
      pendingDemoCount = await RegistrationModel.countDocuments({
        _id: { $in: regIds },
        status: "demo_booked",
      });
    }
  }

  const unreadNotifications = await TeamManagerNotificationModel.countDocuments({
    teamManagerUserId: tmOid,
    isRead: false,
  });

  const tmProfile = await UserModel.findById(tmUserId).select("name email").lean();

  return {
    manager: {
      name: tmProfile?.name ?? "",
      email: tmProfile?.email ?? "",
    },
    summary: {
      pendingDemoApprovals: pendingDemoCount,
      unreadNotifications,
    },
    scheduleTimezone: env.demoScheduleTimezone,
  };
}

export async function listDemoQueue(tmUserId: string) {
  await requireTeamManagerUser(tmUserId);
  const tmOid = new Types.ObjectId(tmUserId);

  const assignmentIds = await DepartmentTeamManagerAssignmentModel.find({ linkedUserId: tmOid })
    .select("_id department")
    .lean();
  const ids = assignmentIds.map((a) => a._id);
  const deptByAssignmentId = new Map(
    assignmentIds.map((a) => [String(a._id), a.department]),
  );

  if (!ids.length) {
    return { queue: [] as Array<Record<string, unknown>>, scheduleTimezone: env.demoScheduleTimezone };
  }

  const bookings = await DemoBookingModel.find({
    departmentTeamManagerAssignmentId: { $in: ids },
  })
    .populate("registrationId")
    .populate("studentId", "name email registrationNumber department gender")
    .populate("gameId", "title venue slug")
    .sort({ startsAt: 1 })
    .lean();

  const queue = bookings
    .map((b) => {
      const reg = b.registrationId as unknown as { _id: Types.ObjectId; status: string } | null;
      if (!reg || reg.status !== "demo_booked") return null;
      const student = b.studentId as unknown as {
        _id: Types.ObjectId;
        name: string;
        email: string;
        registrationNumber?: string;
        department?: string;
        gender?: string;
      } | null;
      const game = b.gameId as unknown as {
        _id: Types.ObjectId;
        title: string;
        venue: string;
        slug?: string;
      } | null;
      return {
        demoBookingId: String(b._id),
        registrationId: String(reg._id),
        assignmentDepartment:
          deptByAssignmentId.get(String(b.departmentTeamManagerAssignmentId)) ?? "",
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        student: student
          ? {
              id: String(student._id),
              name: student.name,
              email: student.email,
              registrationNumber: student.registrationNumber ?? "",
              department: student.department ?? "",
              gender: student.gender ?? "",
            }
          : null,
        game: game
          ? {
              id: String(game._id),
              title: game.title,
              venue: game.venue,
              slug: game.slug ?? "",
            }
          : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return { queue, scheduleTimezone: env.demoScheduleTimezone };
}

export async function listTeamManagerNotifications(tmUserId: string) {
  await requireTeamManagerUser(tmUserId);
  const rows = await TeamManagerNotificationModel.find({ teamManagerUserId: new Types.ObjectId(tmUserId) })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return {
    notifications: rows.map((n) => ({
      id: String(n._id),
      title: n.title,
      message: n.message,
      registrationId: n.registrationId ? String(n.registrationId) : null,
      demoBookingId: n.demoBookingId ? String(n.demoBookingId) : null,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function markTeamManagerNotificationRead(tmUserId: string, notificationId: string) {
  await requireTeamManagerUser(tmUserId);
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new AppError("Invalid notification id.", 400);
  }
  const updated = await TeamManagerNotificationModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(notificationId),
      teamManagerUserId: new Types.ObjectId(tmUserId),
    },
    { $set: { isRead: true } },
    { new: true },
  ).lean();
  if (!updated) {
    throw new AppError("Notification not found.", 404);
  }
  return { ok: true };
}
