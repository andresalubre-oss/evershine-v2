const { Resend } = require('resend');

let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('RESEND_API_KEY is not set — verification emails will be skipped (logged, not sent).');
}


const FROM = process.env.EMAIL_FROM || 'Evershine Booking <onboarding@resend.dev>';

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

async function sendGuestVerificationCode(toEmail, code) {
  if (!resend) {
    console.warn(`(RESEND_API_KEY not set) Would have sent guest verification code to ${toEmail}: ${code}`);
    return;
  }
  
  const { error } = await resend.emails.send({
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
  if (error) throw new Error(`Resend rejected the guest verification email: ${error.message || JSON.stringify(error)}`);
}

const CONTACT_TO = process.env.CONTACT_EMAIL || 'evershine.booking@gmail.com';


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


const TERMINAL_NAME = 'Padre Burgos Terminal';
const TERMINAL_ADDRESS = 'Padre Burgos Port, Southern Leyte, 6600 Philippines';
const SUPPORT_PHONE = '+63 924565632';
const SUPPORT_EMAIL = 'evershine.booking@gmail.com';


const CANCELLATION_RATES = [
  { when: 'More than 24 hours before departure', refund: '80% refund' },
  { when: 'Within 24 hours of departure', refund: '60% refund' },
  { when: 'After the scheduled departure', refund: 'No refund' },
];
const CANCELLATION_NOTES = [
  'Cancel any time before departure from Manage Booking on our website, using your reference code and contact email.',
  'The refund rate depends on when you submit the request and is fixed at that moment. It is applied to the total you paid, VAT included.',
  'Refunds are reviewed manually. Our team sends the refund once your request is verified, so it is not instant.',
  'If Evershine cancels or suspends a sailing, for example because of weather, you receive a full refund or free rebooking to the next available trip.',
];
const GOOD_TO_KNOW = [
  'Arrive at the terminal at least 30 minutes before departure. Boarding closes shortly before departure, and late arrivals may forfeit their seat without a refund.',
  "Bring a valid government-issued ID matching each passenger's name.",
  'Senior Citizen, PWD and Student fares need the ID used for Profile Verification. Terminal staff may ask to see it.',
  'Baggage: one hand-carried piece per passenger. Flammable, explosive and other hazardous items are not allowed. Bulky cargo must be arranged with the terminal in advance.',
  'Fares include 12% VAT, except Senior Citizen and PWD fares, which are VAT-exempt.',
];

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function passengerFullName(p) {
  return [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ');
}


function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


async function sendBookingInvoice(booking) {
  const ports = PORT_NAMES[booking.schedule.direction] || { from: '', to: '' };

  const departure = new Date(booking.schedule.departureDatetime).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
  const bookedOn = new Date(booking.createdAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  });
  const passengerCount = booking.passengers.length;

  const logoUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/evershine-logo.png`;
  const manageBookingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/manage-booking`;
 
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
                    <td style="padding-top:10px;text-align:right;font-size:13px;color:#6b7280;">Subtotal (excluding VAT): ${formatPeso(Number(booking.totalFare) - Number(booking.vatAmount || 0))}</td>
                  </tr>
                  <tr>
                    <td style="padding-top:4px;text-align:right;font-size:13px;color:#6b7280;">VAT (12%): ${formatPeso(booking.vatAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td style="padding-top:10px;text-align:right;font-size:16px;font-weight:800;color:#111827;">Total Paid: ${formatPeso(booking.totalFare)}</td>
                  </tr>
                  <tr>
                    <td style="padding-top:4px;text-align:right;font-size:11px;color:#9ca3af;">Senior Citizen and PWD fares are VAT-exempt.</td>
                  </tr>
                </table>

                <table role="presentation" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:28px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400e;">Before You Board</p>
                      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:#78350f;">
                        <li>Arrive at the terminal at least 30 minutes before departure.</li>
                        <li>Bring a valid government ID matching each passenger's name above.</li>
                      </ul>
                    </td>
                  </tr>
                </table>

                <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#111827;border-bottom:2px solid #111827;padding-bottom:8px;">Ticket Cancellation Policy</h2>
                <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:12px;font-size:14px;">
                  ${CANCELLATION_RATES.map((r) => `
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;">${r.when}</td>
                    <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;">${r.refund}</td>
                  </tr>`).join('')}
                </table>
                <ul style="margin:0 0 28px;padding-left:18px;font-size:13px;line-height:1.7;color:#4b5563;">
                  ${CANCELLATION_NOTES.map((n) => `<li>${n}</li>`).join('')}
                </ul>

                <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#111827;border-bottom:2px solid #111827;padding-bottom:8px;">Good to Know</h2>
                <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:#4b5563;">
                  ${GOOD_TO_KNOW.map((n) => `<li>${n}</li>`).join('')}
                </ul>

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
  PORT_NAMES,
  CANCELLATION_RATES,
  CANCELLATION_NOTES,
  GOOD_TO_KNOW,
  TERMINAL_NAME,
  TERMINAL_ADDRESS,
  SUPPORT_PHONE,
  SUPPORT_EMAIL,
  formatPeso,
  passengerFullName,
};