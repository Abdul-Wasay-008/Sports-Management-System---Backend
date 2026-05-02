import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import { EmailOtpModel } from "../models/EmailOtp.js";
import { UserModel } from "../models/User.js";
import { generateOtp, hashOtp } from "../utils/crypto.js";
import { AppError } from "../utils/errors.js";
import { signAuthToken } from "../utils/jwt.js";
import {
  assertCustEmail,
  canonicalCustEmail,
  isCustEmail,
  normalizeEmail,
  sanitizeDepartment,
  sanitizeRegistrationNumber,
} from "../utils/validators.js";
import { sendVerificationOtpEmail } from "./email.service.js";

const PASSWORD_ROUNDS = 10;
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

function isDuplicateKeyError(err: unknown): err is { code: number; keyPattern?: Record<string, 1> } {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000,
  );
}

function throwDuplicateConflictFromDb(err: unknown): never {
  if (isDuplicateKeyError(err)) {
    const keyPattern = err.keyPattern ?? {};
    if (keyPattern.email) {
      throw new AppError("An account with this email already exists.", 409);
    }
    if (keyPattern.registrationNumber) {
      throw new AppError("This registration number is already in use.", 409);
    }
    throw new AppError("Email or registration number is already in use.", 409);
  }
  throw err;
}

type RegisterInput = {
  name: string;
  email: string;
  registrationNumber: string;
  gender: "male" | "female";
  department: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type VerifyEmailInput = {
  email: string;
  otp: string;
};

type ResendOtpInput = {
  email: string;
};

function sanitizeOtpInput(otp: string) {
  return otp.replace(/\D/g, "").slice(0, 5);
}

async function invalidatePreviousOtps(userId: Types.ObjectId) {
  await EmailOtpModel.updateMany(
    { userId, consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );
}

async function issueAndSendOtp(userId: Types.ObjectId, email: string) {
  const otp = generateOtp(5);
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);

  await invalidatePreviousOtps(userId);

  await EmailOtpModel.create({
    userId,
    email,
    otpHash,
    expiresAt,
    attempts: 0,
  });

  await sendVerificationOtpEmail({
    to: email,
    otp,
    expiresInMinutes: env.otpExpiryMinutes,
  });
}

export function toPublicUser(user: {
  _id: Types.ObjectId | string;
  name: string;
  email: string;
  registrationNumber?: string;
  gender?: "male" | "female";
  department?: string;
  role: "student" | "admin" | "team_manager";
  status: "active" | "inactive" | "suspended";
  emailVerified: boolean;
}) {
  if (user.role === "admin" || user.role === "team_manager") {
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
    };
  }
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    registrationNumber: user.registrationNumber as string,
    gender: user.gender as "male" | "female",
    department: user.department as string,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
  };
}

export async function registerStudent(input: RegisterInput) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  assertCustEmail(email);

  const registrationNumber = sanitizeRegistrationNumber(input.registrationNumber);
  const department = sanitizeDepartment(input.department);
  const password = input.password.trim();

  if (!name || !registrationNumber || !department || !password) {
    throw new AppError("All required fields must be provided.", 400);
  }

  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters.", 400);
  }

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    throw new AppError(
      "Password must include at least one uppercase letter and one number.",
      400,
    );
  }

  const existingUser = await UserModel.findOne({ email });
  const existingRegistrationUser = await UserModel.findOne({ registrationNumber });
  const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);

  if (existingUser && existingUser.emailVerified) {
    throw new AppError("An account with this email already exists.", 409);
  }

  if (
    existingRegistrationUser &&
    (!existingUser || String(existingRegistrationUser._id) !== String(existingUser._id))
  ) {
    throw new AppError("This registration number is already in use.", 409);
  }

  let user = existingUser;
  if (!user) {
    try {
      user = await UserModel.create({
        email,
        name,
        registrationNumber,
        gender: input.gender,
        department,
        passwordHash,
        emailVerified: false,
        status: "active",
        role: "student",
      });
    } catch (err) {
      throwDuplicateConflictFromDb(err);
    }
  } else {
    user.registrationNumber = registrationNumber;
    user.name = name;
    user.gender = input.gender;
    user.department = department;
    user.passwordHash = passwordHash;
    user.status = "active";
    user.emailVerified = false;
    user.emailVerifiedAt = undefined;
    try {
      await user.save();
    } catch (err) {
      throwDuplicateConflictFromDb(err);
    }
  }

  await issueAndSendOtp(user._id, email);

  return {
    message: "Registration successful. Verification code sent to your email.",
    user: toPublicUser(user.toObject()),
  };
}

export async function verifyStudentEmail(input: VerifyEmailInput) {
  const email = normalizeEmail(input.email);
  assertCustEmail(email);

  const otp = sanitizeOtpInput(input.otp);
  if (otp.length !== 5) {
    throw new AppError("Please enter a valid 5-digit verification code.", 400);
  }

  const user = await UserModel.findOne({ email });
  if (!user) {
    throw new AppError("No account found for this email.", 404);
  }

  const otpRecord = await EmailOtpModel.findOne({
    userId: user._id,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new AppError("No active verification code found. Please request a new code.", 400);
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    throw new AppError("Verification code has expired. Please request a new code.", 400);
  }

  if (otpRecord.attempts >= env.otpMaxAttempts) {
    throw new AppError("Maximum verification attempts exceeded. Please request a new code.", 429);
  }

  const incomingHash = hashOtp(otp);
  if (incomingHash !== otpRecord.otpHash) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new AppError("Invalid verification code.", 400);
  }

  otpRecord.consumedAt = new Date();
  await otpRecord.save();

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save();

  const token = signAuthToken({
    sub: String(user._id),
    email: user.email,
    role: user.role,
  });

  return {
    message: "Email verified successfully.",
    token,
    user: toPublicUser(user.toObject()),
  };
}

export async function resendVerificationOtp(input: ResendOtpInput) {
  const email = normalizeEmail(input.email);
  assertCustEmail(email);

  const user = await UserModel.findOne({ email });
  if (!user) {
    throw new AppError("No account found for this email.", 404);
  }

  if (user.emailVerified) {
    throw new AppError("Email is already verified. Please sign in.", 400);
  }

  const latestOtp = await EmailOtpModel.findOne({ userId: user._id }).sort({ createdAt: -1 });
  if (latestOtp) {
    const cooldownEndsAt =
      latestOtp.createdAt.getTime() + env.otpResendCooldownSeconds * 1000;
    if (cooldownEndsAt > Date.now()) {
      const secondsRemaining = Math.ceil((cooldownEndsAt - Date.now()) / 1000);
      throw new AppError(`Please wait ${secondsRemaining}s before requesting another code.`, 429);
    }
  }

  await issueAndSendOtp(user._id, email);
  return { message: "A new verification code has been sent to your email." };
}

export async function loginStudent(input: LoginInput) {
  const email = normalizeEmail(input.email);

  let user = await UserModel.findOne({ email });
  if (!user && isCustEmail(email)) {
    const canonical = canonicalCustEmail(email);
    if (canonical !== email) {
      user = await UserModel.findOne({ email: canonical });
    }
  }
  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (user.role !== "admin") {
    assertCustEmail(email);
  }

  const privilegedLoginRoles = user.role === "admin" || user.role === "team_manager";

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (!privilegedLoginRoles && !user.emailVerified) {
    throw new AppError("Please verify your email before signing in.", 403);
  }

  if (user.status !== "active") {
    throw new AppError("Your account is inactive. Please contact an administrator.", 403);
  }

  const token = signAuthToken({
    sub: String(user._id),
    email: user.email,
    role: user.role,
  });

  return {
    message: "Login successful.",
    token,
    user: toPublicUser(user.toObject()),
  };
}

export async function getCurrentUser(userId: string) {
  const user = await UserModel.findById(userId).select(
    "_id name email registrationNumber gender department role status emailVerified",
  );
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return toPublicUser(user.toObject());
}
