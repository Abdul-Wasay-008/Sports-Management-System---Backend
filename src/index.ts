import mongoose from "mongoose";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./lib/db.js";

async function main() {
  if (env.mongodbUri) {
    await connectDatabase(env.mongodbUri);
    console.log("MongoDB connected");
  } else {
    console.warn(
      "MONGODB_URI is not set — API will run without a database connection.",
    );
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    if (mongoose.connection.readyState !== 0) {
      await disconnectDatabase();
    }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
