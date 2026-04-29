import bcrypt from "bcryptjs";
import { ADMIN_BOOTSTRAP } from "../config/admin.js";
import { UserModel } from "../models/User.js";

const PASSWORD_ROUNDS = 12;

export async function ensureAdminUser() {
  const existingAdmin = await UserModel.findOne({ role: "admin" });
  if (existingAdmin) {
    console.log("[admin-bootstrap] Admin already exists. Skipping bootstrap.");
    return;
  }

  const email = ADMIN_BOOTSTRAP.email.toLowerCase().trim();
  const existing = await UserModel.findOne({ email });

  if (existing) {
    const updates: Record<string, unknown> = {
      role: "admin",
      status: "active",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    };

    const passwordMatches = await bcrypt.compare(ADMIN_BOOTSTRAP.password, existing.passwordHash);
    if (!passwordMatches) {
      updates.passwordHash = await bcrypt.hash(ADMIN_BOOTSTRAP.password, PASSWORD_ROUNDS);
    }

    await UserModel.updateOne({ _id: existing._id }, { $set: updates });
    console.log("[admin-bootstrap] Promoted configured account to admin.");
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_BOOTSTRAP.password, PASSWORD_ROUNDS);
  await UserModel.create({
    name: ADMIN_BOOTSTRAP.name,
    email,
    passwordHash,
    role: "admin",
    status: "active",
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });
  console.log("[admin-bootstrap] Created platform admin user.");
}
