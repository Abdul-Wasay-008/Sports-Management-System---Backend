import { Router } from "express";
import {
  loginHandler,
  meHandler,
  registerHandler,
  resendOtpHandler,
  verifyEmailHandler,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.post("/register", registerHandler);
authRouter.post("/verify-email", verifyEmailHandler);
authRouter.post("/resend-otp", resendOtpHandler);
authRouter.post("/login", loginHandler);
authRouter.get("/me", requireAuth, meHandler);
