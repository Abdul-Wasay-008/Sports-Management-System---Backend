import { Schema, model } from "mongoose";

export interface SportDocument {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const sportSchema = new Schema<SportDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  },
  { timestamps: true },
);

export const SportModel = model<SportDocument>("Sport", sportSchema);
