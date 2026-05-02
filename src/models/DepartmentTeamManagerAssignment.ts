import { Schema, Types, model } from "mongoose";
import { SPORTS_WEEK_DEPARTMENTS } from "../constants/sports-week.js";

export interface DepartmentTeamManagerMember {
  name: string;
  contact?: string;
  linkedUserId?: Types.ObjectId;
}

export interface DepartmentTeamManagerAssignmentDocument {
  gameCategoryId: Types.ObjectId;
  department: (typeof SPORTS_WEEK_DEPARTMENTS)[number];
  managerName: string;
  contact?: string;
  members: DepartmentTeamManagerMember[];
  createdAt: Date;
  updatedAt: Date;
}

const departmentTeamManagerMemberSchema = new Schema<DepartmentTeamManagerMember>(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: false, trim: true },
    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { _id: false },
);

const departmentTeamManagerAssignmentSchema = new Schema<DepartmentTeamManagerAssignmentDocument>(
  {
    gameCategoryId: { type: Schema.Types.ObjectId, ref: "GameCategory", required: true, index: true },
    department: { type: String, enum: SPORTS_WEEK_DEPARTMENTS, required: true },
    managerName: { type: String, required: true, trim: true },
    contact: { type: String, required: false, trim: true },
    members: {
      type: [departmentTeamManagerMemberSchema],
      default: [],
      required: true,
    },
  },
  { timestamps: true },
);

departmentTeamManagerAssignmentSchema.index({ gameCategoryId: 1, department: 1 }, { unique: true });
departmentTeamManagerAssignmentSchema.index({ "members.linkedUserId": 1 });

export const DepartmentTeamManagerAssignmentModel = model<DepartmentTeamManagerAssignmentDocument>(
  "DepartmentTeamManagerAssignment",
  departmentTeamManagerAssignmentSchema,
);
