import mongoose from "mongoose";

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
