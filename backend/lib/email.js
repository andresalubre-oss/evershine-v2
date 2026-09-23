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

const PORT_NAMES = {
  PB_TO_LIMASAWA: { from: 'Padre Burgos', to: 'Limasawa' },
  LIMASAWA_TO_PB: { from: 'Limasawa', to: 'Padre Burgos' },
};

// Matches the terminal/support details in the site's own footer
// (frontend/src/components/Footer.jsx) so the two stay consistent, update
// both together if this ever changes.
const TERMINAL_NAME = 'Padre Burgos Terminal';
const TERMINAL_ADDRESS = 'Padre Burgos Port, Southern Leyte, 6600 Philippines';
const SUPPORT_PHONE = '+63 924565632';
const SUPPORT_EMAIL = 'evershine.booking@gmail.com';

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function passengerFullName(p) {
  return [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ');
}

// Passenger names and the ferry name ultimately come from a customer/admin
// form field, not a fixed value the app controls, so they're escaped before
// going into the email's HTML the same way sendContactMessage already
// escapes its own user-supplied fields.
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Sent once a booking's payment actually clears. See the two places in
// index.js that flip a booking to 'confirmed' (the PayMongo webhook and the
// payment-status poll), both call this the same way afterward. Doubles as
// the customer's boarding proof, so the reference code is the single most
// prominent thing in the email: the same code port staff or Manage Booking
// would check it against. Never throws, same reasoning as
// sendVerificationEmail: a failed send shouldn't undo an already-successful
// payment, the booking stays confirmed either way and the customer can still
// pull it up through Manage Booking with their reference code and email.
async function sendBookingInvoice(booking) {
  const ports = PORT_NAMES[booking.schedule.direction] || { from: '', to: '' };
  // Always rendered in Philippine time, regardless of what timezone the
  // server process itself runs in (Render's servers default to UTC) — the
  // ferry departs at a fixed real-world Manila-time slot, and that must
  // never shift based on where the backend or the reader happens to be.
  const departure = new Date(booking.schedule.departureDatetime).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
  const bookedOn = new Date(booking.createdAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  });
  const passengerCount = booking.passengers.length;
  // Same public/ frontend asset the site's own nav bar and footer use, built
  // into an absolute URL since email clients can't resolve a relative path
  // the way a browser can.
  const logoUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/evershine-logo.png`;
  const manageBookingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/manage-booking`;
  // Points at the API server itself, not the frontend — BACKEND_URL needs to
  // be set to the backend's public URL (e.g. Render's service URL) in
  // production for this link to resolve; falls back to the local dev API
  // port so it still works when testing without that env var set.
  const invoicePdfUrl = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/bookings/invoice-pdf?reference_code=${encodeURIComponent(booking.referenceCode)}&contact_email=${encodeURIComponent(booking.contactEmail)}`;

  if (!resend) {
    console.warn(`(RESEND_API_KEY not set) Would have sent booking invoice for ${booking.referenceCode} to ${booking.contactEmail}`);
    return;
  }

  const passengerRows = booking.passengers.map((p) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${escapeHtml(passengerFullName(p))}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#4b5563;text-transform:capitalize;">${p.discountType === 'none' ? 'Regular' : escapeHtml(p.discountType)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;font-weight:600;">${formatPeso(p.fare)}</td>
    </tr>
  `).join('');

  try {
    await resend.emails.send({
      from: FROM,
      to: booking.contactEmail,
      subject: `Your Evershine Booking ticket, ${booking.referenceCode}`,
      html: `
        <div style="background:#f3f4f6;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
          <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">

            <!-- Header: logo on white with a solid teal accent bar underneath,
                 same brand color as the site's nav/footer accents rather than
                 a colored banner behind the logo, so the logo's own
                 background stays clean. -->
            <tr>
              <td style="padding:28px 32px 20px;text-align:center;">
                <img src="${logoUrl}" alt="Evershine Booking" height="42" style="height:42px;width:auto;" />
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:#0f766e;line-height:0;font-size:0;">&nbsp;</td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0f766e;">Booking Confirmed</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827;">Your ${passengerCount > 1 ? 'tickets are' : 'ticket is'} ready</h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
                  Thank you for booking with Evershine Booking. Your payment has been received and your
                  ${passengerCount > 1 ? `${passengerCount} seats are` : 'seat is'} confirmed. Present this email, or just your reference
                  code below, at the terminal during boarding.
                </p>

                <table role="presentation" width="100%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;margin-bottom:16px;">
                  <tr>
                    <td style="padding:18px;text-align:center;">
                      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0f766e;">Reference Code</p>
                      <p style="margin:6px 0 0;font-size:28px;font-weight:800;letter-spacing:3px;color:#042f2e;">${booking.referenceCode}</p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 28px;text-align:center;">
                  <a href="${invoicePdfUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
                    Download Invoice (PDF)
                  </a>
                </p>

                <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#111827;border-bottom:2px solid #111827;padding-bottom:8px;">Trip Details</h2>
                <table role="presentation" width="100%" style="font-size:14px;color:#374151;margin-bottom:28px;">
                  <tr><td style="padding:6px 0;color:#6b7280;width:42%;">Route</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">${ports.from} &rarr; ${ports.to}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Departure</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">${departure}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Ferry</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">${escapeHtml(booking.schedule.ferry?.name || 'Not set')}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Booked On</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">${bookedOn}</td></tr>
                </table>

                <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#111827;border-bottom:2px solid #111827;padding-bottom:8px;">Passengers (${passengerCount})</h2>
                <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:8px;">
                  <thead>
                    <tr>
                      <th style="text-align:left;padding-bottom:8px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#6b7280;">Name</th>
                      <th style="text-align:left;padding-bottom:8px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#6b7280;">Fare Type</th>
                      <th style="text-align:right;padding-bottom:8px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#6b7280;">Fare</th>
                    </tr>
                  </thead>
                  <tbody>${passengerRows}</tbody>
                </table>
                <table role="presentation" width="100%" style="margin-bottom:28px;">
                  <tr>
                    <td style="padding-top:10px;text-align:right;font-size:16px;font-weight:800;color:#111827;">Total Paid: ${formatPeso(booking.totalFare)}</td>
                  </tr>
                </table>

                <table role="presentation" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400e;">Before You Board</p>
                      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:#78350f;">
                        <li>Arrive at the terminal at least 30 minutes before departure.</li>
                        <li>Bring a valid government ID matching each passenger's name above.</li>
                        <li>Discount ID (Senior, PWD, or Student) is required for a discounted fare.</li>
                      </ul>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  Need to look up, cancel, or get directions for this booking later? Visit
                  <a href="${manageBookingUrl}" style="color:#0f766e;font-weight:600;text-decoration:none;">Manage Booking</a>
                  and enter your reference code with this email address.
                </p>
              </td>
            </tr>

            <!-- Footer: terminal + support details, same brand color and
                 copy as the site's own footer. -->
            <tr>
              <td style="background:#042f2e;padding:24px 32px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#ffffff;">${TERMINAL_NAME}</p>
                <p style="margin:0 0 10px;font-size:12px;color:#99f6e4;">${TERMINAL_ADDRESS}</p>
                <p style="margin:0;font-size:12px;color:#99f6e4;">${SUPPORT_PHONE} &middot; ${SUPPORT_EMAIL}</p>
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:16px auto 0;text-align:center;font-size:11px;color:#9ca3af;">
            This is an automated message from Evershine Booking. Please do not reply directly to this email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send booking invoice:', err);
  }
}

// Sends the passenger manifest for one sailing as a PDF attachment — used by
// the admin's "Send Manifest" action (Coast Guard coordination, or any other
// recipient an admin types in). Unlike the booking invoice, this always
// throws on failure: an admin explicitly clicked "Send" expecting it to go
// out immediately, so silently swallowing a failure here would leave them
// thinking the Coast Guard has a manifest they don't actually have yet.
async function sendManifestEmail(toEmails, schedule, pdfBuffer, passengerCount) {
  const ports = PORT_NAMES[schedule.direction] || { from: '', to: '' };
  const departure = new Date(schedule.departureDatetime).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
  const filenameDate = new Date(schedule.departureDatetime).toISOString().slice(0, 10);

  if (!resend) {
    console.warn(`(RESEND_API_KEY not set) Would have sent the manifest for ${schedule.id} to ${toEmails.join(', ')}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: toEmails,
    subject: `Passenger Manifest — ${ports.from} to ${ports.to}, ${departure}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
        <h2 style="color: #0f766e; margin-bottom: 4px;">Passenger Manifest</h2>
        <p style="color:#6b7280;font-size:13px;margin-top:0;">Evershine Booking &middot; Padre Burgos &harr; Limasawa</p>
        <table role="presentation" width="100%" style="font-size:14px;margin:20px 0;">
          <tr><td style="padding:4px 0;color:#6b7280;width:40%;">Route</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(ports.from)} &rarr; ${escapeHtml(ports.to)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Departure</td><td style="padding:4px 0;font-weight:600;">${departure}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Ferry</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(schedule.ferry?.name || 'Not set')}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Passengers</td><td style="padding:4px 0;font-weight:600;">${passengerCount}</td></tr>
        </table>
        <p style="font-size:13px;color:#4b5563;">The full passenger list is attached as a PDF.</p>
        <p style="color:#9ca3af;font-size:11px;margin-top:24px;">Sent from the Evershine Booking admin dashboard. This is an automated message.</p>
      </div>
    `,
    attachments: [
      {
        filename: `evershine-manifest-${filenameDate}.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ],
  });
}

module.exports = {
  sendVerificationEmail,
  sendGuestVerificationCode,
  sendContactMessage,
  sendBookingInvoice,
  sendManifestEmail,
  // Exported so the PDF invoice generator (lib/pdfInvoice.js) can reuse the
  // exact same port names, terminal/support details, and formatting instead
  // of a second, driftable copy of the same constants.
  PORT_NAMES,
  TERMINAL_NAME,
  TERMINAL_ADDRESS,
  SUPPORT_PHONE,
  SUPPORT_EMAIL,
  formatPeso,
  passengerFullName,
};