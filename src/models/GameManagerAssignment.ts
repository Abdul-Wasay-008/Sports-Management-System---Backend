import { Schema, Types, model } from "mongoose";

export interface GameManagerAssignmentDocument {
  managerId: Types.ObjectId;
  gameCategoryId: Types.ObjectId;
  roleLabel: string;
  createdAt: Date;
  updatedAt: Date;
}

const gameManagerAssignmentSchema = new Schema<GameManagerAssignmentDocument>(
  {
    managerId: { type: Schema.Types.ObjectId, ref: "GameManager", required: true, index: true },
    gameCategoryId: { type: Schema.Types.ObjectId, ref: "GameCategory", required: true, index: true },
    roleLabel: { type: String, required: true, trim: true, default: "Game Manager" },
  },
  { timestamps: true },
);

gameManagerAssignmentSchema.index({ managerId: 1, gameCategoryId: 1 }, { unique: true });

export const GameManagerAssignmentModel = model<GameManagerAssignmentDocument>(
  "GameManagerAssignment",
  gameManagerAssignmentSchema,
);
