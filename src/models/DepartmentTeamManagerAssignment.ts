import { Schema, Types, model } from "mongoose";
import { SPORTS_WEEK_DEPARTMENTS } from "../constants/sports-week.js";

export interface DepartmentTeamManagerAssignmentDocument {
  gameCategoryId: Types.ObjectId;
  department: (typeof SPORTS_WEEK_DEPARTMENTS)[number];
  managerName: string;
  contact?: string;
  createdAt: Date;
  updatedAt: Date;
}

const departmentTeamManagerAssignmentSchema = new Schema<DepartmentTeamManagerAssignmentDocument>(
  {
    gameCategoryId: { type: Schema.Types.ObjectId, ref: "GameCategory", required: true, index: true },
    department: { type: String, enum: SPORTS_WEEK_DEPARTMENTS, required: true },
    managerName: { type: String, required: true, trim: true },
    contact: { type: String, required: false, trim: true },
  },
  { timestamps: true },
);

departmentTeamManagerAssignmentSchema.index({ gameCategoryId: 1, department: 1 }, { unique: true });

export const DepartmentTeamManagerAssignmentModel = model<DepartmentTeamManagerAssignmentDocument>(
  "DepartmentTeamManagerAssignment",
  departmentTeamManagerAssignmentSchema,
);
