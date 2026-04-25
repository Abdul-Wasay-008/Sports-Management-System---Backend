import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getCurrentUser,
  loginStudent,
  registerStudent,
  resendVerificationOtp,
  verifyStudentEmail,
} from "../services/auth.service.js";
import { AppError } from "../utils/errors.js";
import { parseStudentGender } from "../utils/validators.js";

function handleError(res: Response, err: unknown) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Something went wrong." });
}

export async function registerHandler(req: Request, res: Response) {
  try {
    const result = await registerStudent({
      name: String(req.body.name ?? ""),
      email: String(req.body.email ?? ""),
      registrationNumber: String(req.body.registrationNumber ?? ""),
      gender: parseStudentGender(req.body.gender),
      department: String(req.body.department ?? ""),
      password: String(req.body.password ?? ""),
    });
    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function verifyEmailHandler(req: Request, res: Response) {
  try {
    const result = await verifyStudentEmail({
      email: String(req.body.email ?? ""),
      otp: String(req.body.otp ?? ""),
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function resendOtpHandler(req: Request, res: Response) {
  try {
    const result = await resendVerificationOtp({
      email: String(req.body.email ?? ""),
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function loginHandler(req: Request, res: Response) {
  try {
    const result = await loginStudent({
      email: String(req.body.email ?? ""),
      password: String(req.body.password ?? ""),
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function meHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ error: "Authentication required." });
    }
    const user = await getCurrentUser(req.authUserId);
    return res.status(200).json({ user });
  } catch (err) {
    return handleError(res, err);
  }
}
