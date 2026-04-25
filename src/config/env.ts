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
  jwtSecret: process.env.JWT_SECRET?.trim() || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || "7d",
  smtpHost: process.env.SMTP_HOST?.trim() || "",
  smtpPort: Number.parseInt(process.env.SMTP_PORT ?? "587", 10),
  smtpUser: process.env.SMTP_USER?.trim() || "",
  smtpPass: process.env.SMTP_PASS?.trim() || "",
  smtpFrom: process.env.SMTP_FROM?.trim() || "no-reply@cust.pk",
  otpExpiryMinutes: Number.parseInt(process.env.OTP_EXPIRY_MINUTES ?? "15", 10),
  otpResendCooldownSeconds: Number.parseInt(
    process.env.OTP_RESEND_COOLDOWN_SECONDS ?? "60",
    10,
  ),
  otpMaxAttempts: Number.parseInt(process.env.OTP_MAX_ATTEMPTS ?? "5", 10),
} as const;
