import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

function canSendEmail() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

export async function sendVerificationOtpEmail(params: {
  to: string;
  otp: string;
  expiresInMinutes: number;
}) {
  const { to, otp, expiresInMinutes } = params;

  if (!canSendEmail()) {
    console.warn(
      `SMTP is not configured. OTP for ${to}: ${otp} (expires in ${expiresInMinutes} minutes)`,
    );
    return;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: env.smtpFrom,
      to,
      subject: "Verify your CUST Sports account",
      text: [
        "CUST Sports - Email Verification",
        "",
        `Your verification code is: ${otp}`,
        `This code expires in ${expiresInMinutes} minutes.`,
        "",
        "If you did not request this code, you can ignore this email.",
      ].join("\n"),
      html: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
                <tr>
                  <td style="background:#0c1222;padding:20px 24px;">
                    <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#fcd34d;font-weight:700;">CUST Sports</div>
                    <div style="margin-top:6px;font-size:22px;line-height:1.2;color:#ffffff;font-weight:700;">Email verification</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 10px 0;color:#0f172a;font-size:15px;line-height:1.6;">
                      Use the code below to verify your email and continue to your account.
                    </p>
                    <div style="margin:14px 0 16px 0;display:inline-block;background:linear-gradient(90deg,#f59e0b,#d97706);color:#05080f;font-weight:800;font-size:34px;letter-spacing:8px;padding:12px 18px;border-radius:12px;">
                      ${otp}
                    </div>
                    <p style="margin:0 0 10px 0;color:#334155;font-size:14px;line-height:1.6;">
                      This code expires in <strong>${expiresInMinutes} minutes</strong>.
                    </p>
                    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                      If you did not request this verification code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 24px;color:#64748b;font-size:12px;line-height:1.5;">
                    CUST Sports Management System
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,
    });
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    throw new AppError("Unable to send verification email right now.", 500);
  }
}
