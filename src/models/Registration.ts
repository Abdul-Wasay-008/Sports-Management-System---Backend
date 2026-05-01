import { Schema, model } from "mongoose";
import type { Types } from "mongoose";
import { STUDENT_GENDERS, SPORTS_WEEK_DEPARTMENTS } from "../constants/sports-week.js";

export type RegistrationStatus =
  | "demo_booked"
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface RegistrationDocument {
  studentId: Types.ObjectId;
  gameId: Types.ObjectId;
  status: RegistrationStatus;
  demoBookingId?: Types.ObjectId;
  decisionNote?: string;
  decidedByManagerId?: Types.ObjectId;
  decidedAt?: Date;
  studentDepartment?: string;
  studentGender?: "male" | "female";
  createdAt: Date;
  updatedAt: Date;
}

const registrationSchema = new Schema<RegistrationDocument>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true, index: true },
    status: {
      type: String,
      enum: ["demo_booked", "pending", "accepted", "rejected", "cancelled"],
      required: true,
      default: "pending",
    },
    demoBookingId: {
      type: Schema.Types.ObjectId,
      ref: "DemoBooking",
      required: false,
      index: true,
    },
    decisionNote: { type: String, required: false, trim: true },
    decidedByManagerId: { type: Schema.Types.ObjectId, ref: "GameManager", required: false },
    decidedAt: { type: Date, required: false },
    studentDepartment: { type: String, enum: SPORTS_WEEK_DEPARTMENTS, required: false, index: true },
    studentGender: { type: String, enum: STUDENT_GENDERS, required: false, index: true },
  },
  { timestamps: true },
);

registrationSchema.index({ studentId: 1, gameId: 1 });

export const RegistrationModel = model<RegistrationDocument>("Registration", registrationSchema);
