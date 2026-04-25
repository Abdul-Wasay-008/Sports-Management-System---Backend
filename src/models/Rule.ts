import { Schema, model } from "mongoose";

export interface RuleDocument {
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const ruleSchema = new Schema<RuleDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export const RuleModel = model<RuleDocument>("Rule", ruleSchema);
