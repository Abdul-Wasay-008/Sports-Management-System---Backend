import { Schema, Types, model } from "mongoose";

export interface NotificationDocument {
  studentId: Types.ObjectId;
  title: string;
  message: string;
  category: "schedule" | "registration" | "result" | "announcement";
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["schedule", "registration", "result", "announcement"],
      required: true,
      default: "announcement",
    },
    isRead: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

export const NotificationModel = model<NotificationDocument>(
  "Notification",
  notificationSchema,
);
