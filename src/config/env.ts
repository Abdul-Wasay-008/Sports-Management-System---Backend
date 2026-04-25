import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";

const corsRaw = process.env.CORS_ORIGIN;
const corsOrigin =
  corsRaw
    ?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) ?? (isProd ? [] : ["http://localhost:3000"]);

export const env = {
  nodeEnv,
  isProd,
  port: Number.parseInt(process.env.PORT ?? "5000", 10),
  mongodbUri: process.env.MONGODB_URI?.trim() || undefined,
  corsOrigin,
} as const;
