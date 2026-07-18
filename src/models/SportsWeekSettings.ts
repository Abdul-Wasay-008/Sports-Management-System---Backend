import { Schema, model, type Types } from "mongoose";

export interface SportsWeekSettingsDocument {
  isActive: boolean;
  seasonLabel: string;
  startDate: Date | null;
  endDate: Date | null;
  announcementMessage: string;
  nextSeasonHint: string;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const sportsWeekSettingsSchema = new Schema<SportsWeekSettingsDocument>(
  {
    isActive: { type: Boolean, required: true, default: false },
    seasonLabel: { type: String, default: "", trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    announcementMessage: {
      type: String,
      default: "Sports Week registrations are currently closed. Check back soon!",
      trim: true,
    },
    nextSeasonHint: { type: String, default: "", trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const SportsWeekSettingsModel = model<SportsWeekSettingsDocument>(
  "SportsWeekSettings",
  sportsWeekSettingsSchema,
);
