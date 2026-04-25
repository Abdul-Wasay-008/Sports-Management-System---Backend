import { Schema, Types, model } from "mongoose";

export type GameGenderCategory = "male" | "female" | "mixed";

export interface GameDocument {
  title: string;
  slug: string;
  description: string;
  genderCategory: GameGenderCategory;
  venue: string;
  rulesSummary: string;
  totalSlots: number;
  acceptedRegistrations: number;
  managerId: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gameSchema = new Schema<GameDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, required: true, trim: true },
    genderCategory: {
      type: String,
      enum: ["male", "female", "mixed"],
      required: true,
      default: "mixed",
    },
    venue: { type: String, required: true, trim: true },
    rulesSummary: { type: String, required: true, trim: true },
    totalSlots: { type: Number, required: true, min: 1 },
    acceptedRegistrations: { type: Number, required: true, min: 0, default: 0 },
    managerId: { type: Schema.Types.ObjectId, ref: "GameManager", required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const GameModel = model<GameDocument>("Game", gameSchema);
