import { Schema, Types, model } from "mongoose";

export type RegistrationStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface RegistrationDocument {
  studentId: Types.ObjectId;
  gameId: Types.ObjectId;
  status: RegistrationStatus;
  decisionNote?: string;
  decidedByManagerId?: Types.ObjectId;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const registrationSchema = new Schema<RegistrationDocument>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      required: true,
      default: "pending",
    },
    decisionNote: { type: String, required: false, trim: true },
    decidedByManagerId: { type: Schema.Types.ObjectId, ref: "GameManager", required: false },
    decidedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

registrationSchema.index({ studentId: 1, gameId: 1 }, { unique: true });

export const RegistrationModel = model<RegistrationDocument>(
  "Registration",
  registrationSchema,
);
