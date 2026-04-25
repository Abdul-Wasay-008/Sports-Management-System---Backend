import { Schema, model } from "mongoose";

export interface CommitteeMemberDocument {
  name: string;
  title: string;
  committeeType: "core";
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const committeeMemberSchema = new Schema<CommitteeMemberDocument>(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    committeeType: { type: String, enum: ["core"], default: "core", required: true },
    order: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

committeeMemberSchema.index({ committeeType: 1, order: 1 }, { unique: true });

export const CommitteeMemberModel = model<CommitteeMemberDocument>(
  "CommitteeMember",
  committeeMemberSchema,
);
