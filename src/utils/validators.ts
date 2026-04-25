import { AppError } from "./errors.js";
import {
  GAME_GENDERS,
  normalizeDepartment,
  SPORTS_WEEK_DEPARTMENTS,
  STUDENT_GENDERS,
} from "../constants/sports-week.js";

const CUST_EMAIL_REGEX = /^[^\s@]+@cust\.pk$/i;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isCustEmail(email: string) {
  return CUST_EMAIL_REGEX.test(normalizeEmail(email));
}

export function assertCustEmail(email: string) {
  if (!isCustEmail(email)) {
    throw new AppError("Only @cust.pk university email addresses are allowed.", 400);
  }
}

export function sanitizeRegistrationNumber(value: string) {
  return value.trim().toUpperCase();
}

export function sanitizeDepartment(value: string) {
  const normalized = normalizeDepartment(value);
  if (!normalized) {
    throw new AppError(
      `Department must be one of: ${SPORTS_WEEK_DEPARTMENTS.join(", ")}`,
      400,
    );
  }
  return normalized;
}

export function parseOptionalDepartmentFilter(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = normalizeDepartment(value);
  if (!normalized) throw new AppError("Invalid department filter.", 400);
  return normalized;
}

export function parseOptionalGenderFilter(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const lowered = value.trim().toLowerCase();
  if (!GAME_GENDERS.includes(lowered as (typeof GAME_GENDERS)[number])) {
    throw new AppError("Invalid gender filter.", 400);
  }
  return lowered as (typeof GAME_GENDERS)[number];
}

export function parseStudentGender(value: unknown): (typeof STUDENT_GENDERS)[number] {
  if (value === "male" || value === "female") return value;
  throw new AppError("Please select a valid gender.", 400);
}
