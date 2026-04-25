import { Schema, model } from "mongoose";

export type UserStatus = "active" | "inactive" | "suspended";
export type UserRole = "student";
export type UserGender = "male" | "female";

export interface UserDocument {
  name: string;
  email: string;
  registrationNumber: string;
  gender: UserGender;
  department: string;
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
    registrationNumber: { type: String, required: true, unique: true, trim: true },
    gender: { type: String, enum: ["male", "female"], required: true },
    department: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student"], default: "student", required: true },
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

export const UserModel = model<UserDocument>("User", userSchema);
