import { Schema, model } from "mongoose";

export interface GameManagerDocument {
  name: string;
  email: string;
  phone: string;
  officeAddress: string;
  officeHours: string;
  department?: string;
  createdAt: Date;
  updatedAt: Date;
}

const gameManagerSchema = new Schema<GameManagerDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    officeAddress: { type: String, required: true, trim: true },
    officeHours: { type: String, required: true, trim: true },
    department: { type: String, required: false, trim: true },
  },
  { timestamps: true },
);

export const GameManagerModel = model<GameManagerDocument>(
  "GameManager",
  gameManagerSchema,
);
