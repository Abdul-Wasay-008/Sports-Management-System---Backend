import { Schema, Types, model } from "mongoose";
import { GAME_GENDERS, type GameGender } from "../constants/sports-week.js";

export interface GameCategoryDocument {
  sportId: Types.ObjectId;
  name: string;
  slug: string;
  gender: GameGender;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gameCategorySchema = new Schema<GameCategoryDocument>(
  {
    sportId: { type: Schema.Types.ObjectId, ref: "Sport", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    gender: { type: String, enum: GAME_GENDERS, required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const GameCategoryModel = model<GameCategoryDocument>("GameCategory", gameCategorySchema);
