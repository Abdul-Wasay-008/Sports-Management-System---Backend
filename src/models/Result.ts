import { Schema, model } from "mongoose";

export interface ResultDocument {
  gameTitle: string;
  winnerDepartment: string;
  runnerUpDepartment?: string;
  playedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const resultSchema = new Schema<ResultDocument>(
  {
    gameTitle: { type: String, required: true, trim: true },
    winnerDepartment: { type: String, required: true, trim: true },
    runnerUpDepartment: { type: String, required: false, trim: true },
    playedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const ResultModel = model<ResultDocument>("Result", resultSchema);
