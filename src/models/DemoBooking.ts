import { Schema, model } from "mongoose";
import type { Types } from "mongoose";

export interface DemoBookingDocument {
  departmentTeamManagerAssignmentId: Types.ObjectId;
  gameId: Types.ObjectId;
  studentId: Types.ObjectId;
  registrationId: Types.ObjectId;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const demoBookingSchema = new Schema<DemoBookingDocument>(
  {
    departmentTeamManagerAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "DepartmentTeamManagerAssignment",
      required: true,
      index: true,
    },
    gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
      unique: true,
    },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
  },
  { timestamps: true },
);

demoBookingSchema.index(
  { departmentTeamManagerAssignmentId: 1, startsAt: 1 },
  { unique: true },
);

export const DemoBookingModel = model<DemoBookingDocument>("DemoBooking", demoBookingSchema);
