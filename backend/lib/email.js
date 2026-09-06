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

// Guest checkout's one-time verification code — a plain 6-digit number
// rather than a link, since it needs to be typed back into the same
// checkout tab the guest is already sitting in, not opened from a separate
// email client.
//
// Unlike sendVerificationEmail, this one DOES throw on failure. Account
// email verification is a soft, optional trust signal — the account works
// either way, so swallowing a send failure is harmless. Here, the code is
// the *only* way a guest can ever prove the address, so if sending it fails,
// the caller needs to know and tell the guest to try again rather than
// claiming success.
async function sendGuestVerificationCode(toEmail, code) {
  if (!resend) {
    console.warn(`(RESEND_API_KEY not set) Would have sent guest verification code to ${toEmail}: ${code}`);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `${code} is your Evershine Booking verification code`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0f766e;">Verify your email</h2>
        <p>Enter this code on the booking page to confirm it's really you:</p>
        <p style="margin: 24px 0; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f766e;">
          ${code}
        </p>
        <p style="color:#6b7280;font-size:13px;">This code expires in 10 minutes.</p>
        <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

// Where a visitor's "Contact Us" message gets delivered. Defaults to the
// same address shown on the Contact Us page / footer; override with
// CONTACT_EMAIL if support should go somewhere else (e.g. a shared inbox).
const CONTACT_TO = process.env.CONTACT_EMAIL || 'evershine.booking@gmail.com';

// Contact Us form submission. Throws on failure — like the guest code, this
// is the visitor's only attempt at reaching support through the site, so a
// silent failure would leave them thinking their message went through when
// it didn't. The route catches this and tells them to try again.
async function sendContactMessage({ name, email, message }) {
  if (!resend) {
    console.warn(`(RESEND_API_KEY not set) Would have sent contact message from ${name} <${email}>: ${message}`);
    return;
  }
  const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  await resend.emails.send({
    from: FROM,
    to: CONTACT_TO,
    replyTo: email,
    subject: `Contact form: ${name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0f766e;">New message from the Contact Us page</h2>
        <p><strong>From:</strong> ${escape(name)} (${escape(email)})</p>
        <p style="white-space: pre-line; border-left: 3px solid #0f766e; padding-left: 12px; margin: 16px 0;">${escape(message)}</p>
        <p style="color:#6b7280;font-size:13px;">Reply to this email to respond directly to ${escape(name)}.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendGuestVerificationCode, sendContactMessage };