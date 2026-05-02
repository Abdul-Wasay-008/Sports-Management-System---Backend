import { Schema, model } from "mongoose";
import {
  SPORTS_WEEK_DEPARTMENTS,
  STUDENT_GENDERS,
  type SportsWeekDepartment,
} from "../constants/sports-week.js";

export type UserStatus = "active" | "inactive" | "suspended";
export type UserRole = "student" | "admin" | "team_manager";
export type UserGender = (typeof STUDENT_GENDERS)[number];

export interface UserDocument {
  name: string;
  email: string;
  registrationNumber?: string;
  gender?: UserGender;
  department?: SportsWeekDepartment;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    registrationNumber: {
      type: String,
      required: false,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    gender: { type: String, enum: STUDENT_GENDERS, required: false },
    department: { type: String, enum: SPORTS_WEEK_DEPARTMENTS, required: false, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["student", "admin", "team_manager"],
      default: "student",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      required: true,
    },
    emailVerified: { type: Boolean, default: false, required: true },
    emailVerifiedAt: { type: Date, required: false },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("validate", function (next) {
  if (this.role === "student") {
    if (!this.registrationNumber?.trim()) {
      return next(new Error("Registration number is required for student accounts."));
    }
    if (!this.gender) {
      return next(new Error("Gender is required for student accounts."));
    }
    if (!this.department) {
      return next(new Error("Department is required for student accounts."));
    }
  }
  next();
});

export const UserModel = model<UserDocument>("User", userSchema);
