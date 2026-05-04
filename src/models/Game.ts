import { Schema, Types, model } from "mongoose";
import { GAME_GENDERS, type GameGender } from "../constants/sports-week.js";

export type GameGenderCategory = GameGender;

export const SLOT_MODES = ["individual", "team"] as const;
export type SlotMode = (typeof SLOT_MODES)[number];

export interface GameSlotEvent {
  name: string;
  perDepartmentPlayers: number;
}

export interface GameSlotPolicy {
  mode: SlotMode;
  perDepartmentPlayers: number;
  events?: GameSlotEvent[];
}

export interface GameDocument {
  title: string;
  slug: string;
  description: string;
  genderCategory: GameGenderCategory;
  venue: string;
  rulesSummary: string;
  /**
   * Derived from `slotPolicy.perDepartmentPlayers * SPORTS_WEEK_DEPARTMENTS.length`
   * (15) at seed/create/update time. Kept on the document for backward
   * compatibility with admin overview aggregates and existing reads.
   */
  totalSlots: number;
  acceptedRegistrations: number;
  /**
   * Per-(game × department) slot configuration sourced from the Sports Week
   * 2025 manual via the seed JSON. Enforced at demo-booking and
   * acceptance time on top of the existing global `totalSlots` cap.
   */
  slotPolicy: GameSlotPolicy;
  managerId: Types.ObjectId;
  gameCategoryId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const slotEventSchema = new Schema<GameSlotEvent>(
  {
    name: { type: String, required: true, trim: true },
    perDepartmentPlayers: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const slotPolicySchema = new Schema<GameSlotPolicy>(
  {
    mode: { type: String, enum: SLOT_MODES, required: true },
    perDepartmentPlayers: { type: Number, required: true, min: 1 },
    events: { type: [slotEventSchema], required: false, default: undefined },
  },
  { _id: false },
);

const gameSchema = new Schema<GameDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, required: true, trim: true },
    genderCategory: {
      type: String,
      enum: GAME_GENDERS,
      required: true,
      default: "mixed",
    },
    venue: { type: String, required: true, trim: true },
    rulesSummary: { type: String, required: true, trim: true },
    totalSlots: { type: Number, required: true, min: 1 },
    acceptedRegistrations: { type: Number, required: true, min: 0, default: 0 },
    slotPolicy: { type: slotPolicySchema, required: true },
    managerId: { type: Schema.Types.ObjectId, ref: "GameManager", required: true },
    gameCategoryId: { type: Schema.Types.ObjectId, ref: "GameCategory", required: false, index: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const GameModel = model<GameDocument>("Game", gameSchema);
