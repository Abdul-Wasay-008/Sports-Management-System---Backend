import { AppError } from "./errors.js";

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
  return value.trim();
}
