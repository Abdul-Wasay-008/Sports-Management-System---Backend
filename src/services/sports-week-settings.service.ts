import { SportsWeekSettingsModel } from "../models/SportsWeekSettings.js";
import { AppError } from "../utils/errors.js";

export interface SportsWeekStatus {
  isActive: boolean;
  seasonLabel: string;
  startDate: string | null;
  endDate: string | null;
  announcementMessage: string;
  nextSeasonHint: string;
}

export interface UpdateSportsWeekSettingsInput {
  isActive?: boolean;
  seasonLabel?: string;
  startDate?: string | null;
  endDate?: string | null;
  announcementMessage?: string;
  nextSeasonHint?: string;
}

/** Returns the singleton settings doc (creates defaults if missing). */
export async function getSportsWeekSettings(): Promise<SportsWeekStatus> {
  let settings = await SportsWeekSettingsModel.findOne().lean();
  if (!settings) {
    settings = await SportsWeekSettingsModel.create({});
  }
  return {
    isActive: settings.isActive,
    seasonLabel: settings.seasonLabel ?? "",
    startDate: settings.startDate ? settings.startDate.toISOString() : null,
    endDate: settings.endDate ? settings.endDate.toISOString() : null,
    announcementMessage: settings.announcementMessage ?? "",
    nextSeasonHint: settings.nextSeasonHint ?? "",
  };
}

/** Upserts the singleton settings doc. */
export async function updateSportsWeekSettings(
  input: UpdateSportsWeekSettingsInput,
  adminUserId: string,
): Promise<SportsWeekStatus> {
  const patch: Record<string, unknown> = { updatedBy: adminUserId };

  if (typeof input.isActive === "boolean") patch.isActive = input.isActive;
  if (typeof input.seasonLabel === "string") patch.seasonLabel = input.seasonLabel.trim();
  if (typeof input.announcementMessage === "string")
    patch.announcementMessage = input.announcementMessage.trim();
  if (typeof input.nextSeasonHint === "string")
    patch.nextSeasonHint = input.nextSeasonHint.trim();

  if ("startDate" in input) {
    if (input.startDate === null || input.startDate === "") {
      patch.startDate = null;
    } else if (typeof input.startDate === "string") {
      const d = new Date(input.startDate);
      if (Number.isNaN(d.getTime())) throw new AppError("Invalid startDate format.", 400);
      patch.startDate = d;
    }
  }

  if ("endDate" in input) {
    if (input.endDate === null || input.endDate === "") {
      patch.endDate = null;
    } else if (typeof input.endDate === "string") {
      const d = new Date(input.endDate);
      if (Number.isNaN(d.getTime())) throw new AppError("Invalid endDate format.", 400);
      patch.endDate = d;
    }
  }

  const updated = await SportsWeekSettingsModel.findOneAndUpdate(
    {},
    { $set: patch },
    { upsert: true, new: true },
  ).lean();

  if (!updated) throw new AppError("Failed to update sports week settings.", 500);

  return {
    isActive: updated.isActive,
    seasonLabel: updated.seasonLabel ?? "",
    startDate: updated.startDate ? updated.startDate.toISOString() : null,
    endDate: updated.endDate ? updated.endDate.toISOString() : null,
    announcementMessage: updated.announcementMessage ?? "",
    nextSeasonHint: updated.nextSeasonHint ?? "",
  };
}

/** Fast active-state check used by middleware and route guards. */
export async function isSportsWeekActive(): Promise<boolean> {
  const settings = await SportsWeekSettingsModel.findOne().select("isActive").lean();
  return settings?.isActive ?? false;
}
