// Save as: backend/lib/email.js

const { Resend } = require('resend');

// The Resend constructor throws immediately if it doesn't get a key — that's
// fine in production (RESEND_API_KEY should always be set there), but it
// would otherwise crash the whole backend on startup for anyone running
// locally without it configured yet. Constructed lazily instead, so a
// missing key just disables email sending (logged once) rather than
// bringing the server down.
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('RESEND_API_KEY is not set — verification emails will be skipped (logged, not sent).');
}

// Resend lets any account send from onboarding@resend.dev without first
// verifying a domain — fine for getting this working, but mail from that
// address is more likely to land in spam and is rate-limited. Once a real
// domain is verified in the Resend dashboard, set EMAIL_FROM (e.g.
// "Evershine Booking <no-reply@yourdomain.com>") to send from it instead.
const FROM = process.env.EMAIL_FROM || 'Evershine Booking <onboarding@resend.dev>';

// Never throws — a failed verification email shouldn't break registration
// itself (the account still gets created; the customer can hit "Resend
// verification email" from their account page later). Errors are logged
// server-side so they're visible without exposing anything to the client.
async function sendVerificationEmail(toEmail, firstName, token) {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
  if (!resend) {
    console.warn(`(RESEND_API_KEY not set) Would have sent verification email to ${toEmail}: ${verifyUrl}`);
    return;
  }
  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: 'Verify your email — Evershine Booking',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #0f766e;">Welcome to Evershine Booking${firstName ? `, ${firstName}` : ''}!</h2>
          <p>Please confirm this is your email address by clicking the button below.</p>
          <p style="margin: 24px 0;">
            <a href="${verifyUrl}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
              Verify Email Address
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px;">
            Or paste this link into your browser:<br />
            <a href="${verifyUrl}">${verifyUrl}</a>
          </p>
          <p style="color:#6b7280;font-size:13px;">This link expires in 24 hours.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send verification email:', err);
  }
}

module.exports = { sendVerificationEmail };