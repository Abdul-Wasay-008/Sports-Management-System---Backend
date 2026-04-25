import { Schema, Types, model } from "mongoose";

export interface EmailOtpDocument {
  userId: Types.ObjectId;
  email: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const emailOtpSchema = new Schema<EmailOtpDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, required: true },
    consumedAt: { type: Date, required: false, default: null },
  },
  {
    timestamps: true,
  },
);

emailOtpSchema.index({ userId: 1, createdAt: -1 });

export const EmailOtpModel = model<EmailOtpDocument>("EmailOtp", emailOtpSchema);
