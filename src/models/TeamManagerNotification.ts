import { Schema, model } from "mongoose";
import type { Types } from "mongoose";

export interface TeamManagerNotificationDocument {
  teamManagerUserId: Types.ObjectId;
  title: string;
  message: string;
  registrationId?: Types.ObjectId;
  demoBookingId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teamManagerNotificationSchema = new Schema<TeamManagerNotificationDocument>(
  {
    teamManagerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    registrationId: { type: Schema.Types.ObjectId, ref: "Registration", required: false, index: true },
    demoBookingId: { type: Schema.Types.ObjectId, ref: "DemoBooking", required: false },
    isRead: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

teamManagerNotificationSchema.index({ teamManagerUserId: 1, createdAt: -1 });

export const TeamManagerNotificationModel = model<TeamManagerNotificationDocument>(
  "TeamManagerNotification",
  teamManagerNotificationSchema,
);
