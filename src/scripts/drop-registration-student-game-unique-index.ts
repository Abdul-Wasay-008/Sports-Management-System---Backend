/**
 * One-time: removes legacy unique index on (studentId, gameId) so students can
 * re-apply after rejection cooldown. Safe to run multiple times.
 *
 * Usage: npx tsx src/scripts/drop-registration-student-game-unique-index.ts
 */
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../lib/db.js";

async function main() {
  if (!env.mongodbUri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  await connectDatabase(env.mongodbUri);
  const coll = mongoose.connection.collection("registrations");
  const indexes = await coll.indexes();
  for (const idx of indexes) {
    const key = idx.key as Record<string, number>;
    const names = Object.keys(key);
    if (
      names.length === 2 &&
      names.includes("studentId") &&
      names.includes("gameId") &&
      idx.unique
    ) {
      const name = idx.name ?? "studentId_1_gameId_1";
      await coll.dropIndex(name);
      console.log(`Dropped unique index: ${name}`);
    }
  }
  console.log("Done.");
  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
