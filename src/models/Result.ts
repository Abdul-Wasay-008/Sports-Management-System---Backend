import { Schema, Types, model } from "mongoose";
import { GAME_GENDERS, type GameGender } from "../constants/sports-week.js";

export interface ResultDocument {
  gameTitle: string;
  gameId?: Types.ObjectId;
  gameCategoryId?: Types.ObjectId;
  genderCategory?: GameGender;
  winnerDepartment: string;
  runnerUpDepartment?: string;
  playedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const resultSchema = new Schema<ResultDocument>(
  {
    gameTitle: { type: String, required: true, trim: true },
    gameId: { type: Schema.Types.ObjectId, ref: "Game", required: false, index: true },
    gameCategoryId: { type: Schema.Types.ObjectId, ref: "GameCategory", required: false, index: true },
    genderCategory: { type: String, enum: GAME_GENDERS, required: false, index: true },
    winnerDepartment: { type: String, required: true, trim: true },
    runnerUpDepartment: { type: String, required: false, trim: true },
    playedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const ResultModel = model<ResultDocument>("Result", resultSchema);
