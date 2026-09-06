require('dotenv').config();

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { z } = require('zod');
// otplib v13 is a ground-up rewrite (low-level generate/verify functions,
// no `authenticator` object) — this code targets the classic v12 API, so
// package.json pins otplib to ^12, not whatever "latest" resolves to.
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
// Allow one 30s step of clock drift either side when checking a submitted code.
authenticator.options = { window: 1 };

const prisma = require('./lib/prisma');
const { requireAuth, requireAdminOrSetup } = require('./middleware/auth');
const validate = require('./middleware/validate');
const paymongo = require('./lib/paymongo');
const { sendVerificationEmail, sendGuestVerificationCode, sendContactMessage } = require('./lib/email');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());

// ---------------------------------------------------------------------------
// PayMongo webhook — MUST be registered before express.json() below, since
// signature verification needs the exact raw request body PayMongo signed.
// Any JSON-parsing middleware ahead of this would change the byte
// representation and break verification.
// ---------------------------------------------------------------------------

app.post(
  '/api/webhooks/paymongo',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['paymongo-signature'];

    if (!signature || !process.env.PAYMONGO_WEBHOOK_SECRET) {
      return res.sendStatus(401);
    }

    const expected = crypto
      .createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');

    let verified = false;
    try {
      verified = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      verified = false; // e.g. mismatched lengths — never trust a malformed signature
    }

    if (!verified) {
      return res.sendStatus(401);
    }

    // Acknowledge quickly, then process. PayMongo expects a fast response
    // and will retry on timeout, so do the real work after responding.
    res.sendStatus(200);

    try {
      const event = JSON.parse(req.body);
      const eventType = event?.data?.attributes?.type;
      const resource = event?.data?.attributes?.data;

      if (eventType === 'payment.paid' || eventType === 'payment_intent.succeeded') {
        const paymentIntentId =
          resource?.attributes?.payment_intent_id ||
          (resource?.type === 'payment_intent' ? resource.id : null);

        if (paymentIntentId) {
          const payment = await prisma.payment.findFirst({ where: { paymentIntentId } });
          // Guard against duplicate deliveries and races with the polling
          // endpoint — only act if this booking isn't already marked paid.
          if (payment && payment.status !== 'paid') {
            await prisma.$transaction([
              prisma.payment.update({
                where: { id: payment.id },
                data: { status: 'paid', paidAt: new Date() },
              }),
              prisma.booking.update({
                where: { id: payment.bookingId },
                data: { status: 'confirmed' },
              }),
            ]);
          }
        }
      }
    } catch (err) {
      console.error('Webhook processing error:', err.message);
    }
  }
);

app.use(express.json({ limit: '100kb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT'],
}));

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
});

const loginByAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body?.email || '').trim().toLowerCase() || ipKeyGenerator(req.ip),
  message: { error: 'Too many login attempts for this account. Please wait 15 minutes and try again.' },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.admin?.id || 'unknown'}`,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});

// Keyed by the target email (not just IP) so someone can't get around the
// limit by switching networks, and so one IP can't be used to spam a bunch
// of different strangers' inboxes with codes either.
const guestCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body?.email || '').trim().toLowerCase() || ipKeyGenerator(req.ip),
  message: { error: 'Too many verification codes requested for this email. Please wait 15 minutes and try again.' },
});

// Keyed by IP only (there's no account/email to scope it to) — just there
// to stop the public Contact Us form from being used to spam an inbox.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please wait a while and try again.' },
});

app.use('/api', publicLimiter);

// ---------------------------------------------------------------------------
// File uploads: local disk, randomized filenames, served only via an
// authenticated admin route (not a public static folder).
// ---------------------------------------------------------------------------

const uploadsDir = path.join(__dirname, 'uploads');
for (const sub of ['discount-ids', 'selfies']) {
  fs.mkdirSync(path.join(uploadsDir, sub), { recursive: true });
}

const imageFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
  }
  cb(null, true);
};

// Profile Verification submits two files at once — the ID photo and a live
// selfie captured from the camera — each routed to its own subfolder based
// on which form field it came in on.
const uploadVerificationFiles = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const sub = file.fieldname === 'selfie' ? 'selfies' : 'discount-ids';
      cb(null, path.join(uploadsDir, sub));
    },
    filename: (req, file, cb) => {
      const ext = file.mimetype.split('/')[1];
      const randomName = crypto.randomBytes(16).toString('hex');
      cb(null, `${randomName}.${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
}).strict();

const twoFactorVerifySchema = z.object({
  pending_token: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
}).strict();

const twoFactorEnableSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
}).strict();

const twoFactorDisableSchema = z.object({
  password: z.string().min(1).max(200),
}).strict();

const registerSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  middle_name: z.string().trim().max(100).optional().or(z.literal('')),
  last_name: z.string().trim().min(1).max(100),
  suffix: z.string().trim().max(20).optional().or(z.literal('')),
  barangay: z.string().trim().min(1).max(150),
  city_municipality: z.string().trim().min(1).max(150),
  province: z.string().trim().min(1).max(150),
  zip_code: z.string().trim().min(1).max(20),
  region: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  contact_number: z.string().trim().min(1).max(30),
}).strict();

const customerLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
}).strict();

const discountRequestSchema = z.object({
  discount_type: z.enum(['senior', 'pwd', 'student']),
}).strict();

// Mirrors registerSchema's name/address fields — a customer can revise
// anything they filled in at signup, from the same Account dashboard where
// they can now also see all of it displayed back to them.
const updateProfileSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  middle_name: z.string().trim().max(100).optional().or(z.literal('')),
  last_name: z.string().trim().min(1).max(100),
  suffix: z.string().trim().max(20).optional().or(z.literal('')),
  barangay: z.string().trim().min(1).max(150),
  city_municipality: z.string().trim().min(1).max(150),
  province: z.string().trim().min(1).max(150),
  zip_code: z.string().trim().min(1).max(20),
  region: z.string().trim().min(1).max(150),
  contact_number: z.string().trim().max(30).optional().or(z.literal('')),
}).strict();

const verifyDiscountSchema = z.object({
  expires_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((val) => new Date(`${val}T00:00:00`) > new Date(), {
      message: 'Expiry date must be in the future',
    }),
}).strict();

const schedulesQuerySchema = z.object({
  direction: z.enum(['PB_TO_LIMASAWA', 'LIMASAWA_TO_PB']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
}).strict();

const passengerSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  middle_name: z.string().trim().max(100).optional().or(z.literal('')),
  last_name: z.string().trim().min(1).max(100),
  suffix: z.string().trim().max(20).optional().or(z.literal('')),
  sex: z.enum(['Male', 'Female']),
  nationality: z.string().trim().min(1).max(100),
  barangay: z.string().trim().min(1).max(150),
  city_municipality: z.string().trim().min(1).max(150),
  province: z.string().trim().min(1).max(150),
  zip_code: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  contact_number: z.string().trim().max(30),
  discount_type: z.enum(['none', 'senior', 'pwd', 'student']),
}).strict();

const createBookingSchema = z.object({
  schedule_id: z.string().uuid(),
  contact_email: z.string().trim().email().max(255),
  contact_number: z.string().trim().max(30),
  passengers: z.array(passengerSchema).min(1).max(10),
  // Only present for guest checkout (no logged-in customer) — proves
  // contact_email was verified via a one-time code. Checked in the route
  // itself, not here; the schema just needs to allow the field through.
  guest_verification_token: z.string().trim().min(1).max(2000).optional(),
}).strict();

const guestSendCodeSchema = z.object({
  email: z.string().trim().email().max(255),
}).strict();

const contactMessageSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1, 'Please enter a message.').max(2000),
}).strict();

const guestVerifyCodeSchema = z.object({
  email: z.string().trim().email().max(255),
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
}).strict();

const refCodeField = z.string().trim().regex(/^EB[A-Z0-9]{6}$/, 'Invalid reference code format');

const lookupQuerySchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
}).strict();

const cancelBookingSchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
  reason: z.string().trim().min(3, 'Please tell us why you want to cancel.').max(500),
}).strict();

const generatePaymentSchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
}).strict();

const paymentStatusQuerySchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
}).strict();

const addFerrySchema = z.object({
  name: z.string().trim().min(1).max(100),
  seat_capacity: z.coerce.number().int().min(1).max(500),
}).strict();

const addScheduleSchema = z.object({
  ferry_id: z.string().uuid(),
  direction: z.enum(['PB_TO_LIMASAWA', 'LIMASAWA_TO_PB']),
  departure_datetime: z.string().min(1).max(30),
  base_fare: z.coerce.number().positive().max(100000),
  // Set by the admin alongside the fare itself. Optional on the wire so
  // existing callers (and the default schema value) still work; each
  // defaults to 20% to match the flat rate this replaces.
  senior_discount_percent: z.coerce.number().min(0).max(100).default(20),
  pwd_discount_percent: z.coerce.number().min(0).max(100).default(20),
  student_discount_percent: z.coerce.number().min(0).max(100).default(20),
}).strict();

const idParamSchema = z.object({ id: z.string().uuid() }).strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Discount rate now comes from the schedule itself (set by the admin when
// the fare was declared) rather than a single flat rate for every type, so
// this needs the schedule row, not just its base fare.
function calculateFare(schedule, discountType) {
  const base = Number(schedule.baseFare);
  const percentByType = {
    senior: schedule.seniorDiscountPercent,
    pwd: schedule.pwdDiscountPercent,
    student: schedule.studentDiscountPercent,
  };
  const percent = percentByType[discountType];
  if (percent != null) {
    return base * (1 - Number(percent) / 100);
  }
  return base;
}

function generateReferenceCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'EB';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function signCustomerToken(customer) {
  return jwt.sign(
    { customerId: customer.id, email: customer.email, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function signAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

// Issued right after a correct password when the account has 2FA enabled.
// Deliberately a different `role` than 'admin' so it can't be used against
// any requireAuth-protected route — it's only good for POST /api/login/2fa,
// and only for 5 minutes.
function signAdminPendingToken(admin) {
  return jwt.sign(
    { id: admin.id, role: 'admin_2fa_pending' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
}

function signAdminSetupToken(admin) {
  return jwt.sign(
    { id: admin.id, role: 'admin_2fa_setup_required' },
    process.env.JWT_SECRET,
    { expiresIn: '20m' }
  );
}

// Best-effort logging — a logging failure should never break login itself,
// so this swallows its own errors instead of throwing.
async function logAdminEvent({ adminId = null, email, event, req }) {
  try {
    await prisma.adminAuditLog.create({
      data: { adminId, email, event, ipAddress: req.ip },
    });
  } catch (err) {
    console.error('Failed to write admin audit log:', err);
  }
}

// A verified discount lapses once discountVerifiedUntil passes — we don't
// mutate the stored status (so admins can still see it was once verified,
// and can re-verify with a fresh date), we just report it as 'expired' to
// anything that checks it, including the booking discount enforcement below.
function isDiscountExpired(customer) {
  return (
    customer.discountStatus === 'verified' &&
    customer.discountVerifiedUntil &&
    customer.discountVerifiedUntil < new Date()
  );
}

function publicCustomer(customer) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    middleName: customer.middleName,
    lastName: customer.lastName,
    suffix: customer.suffix,
    // Computed convenience field — pages that haven't been updated to the
    // structured name yet (Account dashboard, Admin) can keep reading
    // `.name` unchanged until they're revised.
    name: [customer.firstName, customer.lastName].filter(Boolean).join(' '),
    email: customer.email,
    contactNumber: customer.contactNumber,
    barangay: customer.barangay,
    cityMunicipality: customer.cityMunicipality,
    province: customer.province,
    zipCode: customer.zipCode,
    region: customer.region,
    discountType: customer.discountType,   // none | senior | pwd | student
    discountStatus: isDiscountExpired(customer) ? 'expired' : customer.discountStatus,
    discountVerifiedUntil: customer.discountVerifiedUntil,
    emailVerified: customer.emailVerified,
    // Exposed so the Account dashboard can show "Member since" — this is
    // read-only account metadata, not something the customer can edit.
    createdAt: customer.createdAt,
  };
}

function generateEmailVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// crypto.randomInt is cryptographically random (unlike Math.random) but
// still gives a plain 6-digit number a guest can type back in, unlike the
// long hex token above which is only ever clicked as part of a link.
function generateSixDigitCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

// Requires a valid customer token — used for routes only a logged-in
// customer may hit (profile, discount request).
function requireCustomerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    if (payload.role !== 'customer') {
      return res.status(401).json({ error: 'Not logged in' });
    }
    req.customerId = payload.customerId;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

// Optional auth — attaches req.customerId if a valid customer token is
// present, but never rejects the request. Used on booking creation so
// guests can still check out, while logged-in customers get recognized.
function attachCustomerIfPresent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      if (payload.role === 'customer') req.customerId = payload.customerId;
    } catch {
      // invalid/expired token — treat this request as a guest instead of rejecting it
    }
  }
  next();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post('/api/login', loginLimiter, loginByAccountLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const admin = await prisma.admin.findUnique({ where: { email } });
  
   if (!admin) {
    await logAdminEvent({ email, event: 'login_failed_unknown_email', req });
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
   if (!passwordMatches) {
    await logAdminEvent({ adminId: admin.id, email, event: 'login_failed_wrong_password', req });
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  // Password alone isn't enough once 2FA is turned on — hand back a
  // short-lived pending token instead of a real session, and require a
  // second call with a valid TOTP code before a usable token is issued.
  if (admin.twoFactorEnabled) {
    return res.json({
      requiresTwoFactor: true,
      pendingToken: signAdminPendingToken(admin),
    });
  }

   // 2FA is mandatory: an admin without it enabled never gets a real
  // session token from a password alone — only a short-lived setup token
  // that's good for nothing except the 2FA setup/enable routes below.
  res.json({
    requiresTwoFactorSetup: true,
    setupToken: signAdminSetupToken(admin),
  });
});
app.post('/api/login/2fa', loginLimiter, validate(twoFactorVerifySchema), async (req, res) => {
  const { pending_token, code } = req.body;

  let payload;
  try {
    payload = jwt.verify(pending_token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'That login attempt expired. Please log in again.' });
  }
  if (payload.role !== 'admin_2fa_pending') {
    return res.status(401).json({ error: 'That login attempt expired. Please log in again.' });
  }

  const admin = await prisma.admin.findUnique({ where: { id: payload.id } });
  if (!admin || !admin.twoFactorEnabled || !admin.totpSecret) {
    return res.status(401).json({ error: 'That login attempt expired. Please log in again.' });
  }

  const valid = authenticator.verify({ token: code, secret: admin.totpSecret });
  if (!valid) {
    await logAdminEvent({ adminId: admin.id, email: admin.email, event: 'login_2fa_code_invalid', req });
    return res.status(400).json({ error: 'Invalid code. Please try again.' });
  }

  await logAdminEvent({ adminId: admin.id, email: admin.email, event: 'login_success', req });
  res.json({
    message: 'Login successful',
    token: signAdminToken(admin),
    admin: { id: admin.id, email: admin.email, name: admin.name, twoFactorEnabled: admin.twoFactorEnabled },
  });
});
app.post('/api/admin/2fa/setup', requireAdminOrSetup, adminLimiter, async (req, res) => {
  const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  const secret = authenticator.generateSecret();
  await prisma.admin.update({ where: { id: admin.id }, data: { totpSecret: secret } });

  const otpauthUrl = authenticator.keyuri(admin.email, 'Evershine Booking Admin', secret);
  const qrCode = await QRCode.toDataURL(otpauthUrl);

  res.json({ qrCode, secret });
});
  

// Step 2: admin proves they actually scanned the QR / added the secret by
// submitting a live code. Only then does 2FA actually start being enforced.
app.post('/api/admin/2fa/enable', requireAdminOrSetup, adminLimiter, validate(twoFactorEnableSchema), async (req, res) => {
  const { code } = req.body;
  const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } });
  if (!admin?.totpSecret) {
    return res.status(400).json({ error: 'Start setup first to get a QR code.' });
  }
  const valid = authenticator.verify({ token: code, secret: admin.totpSecret });
  if (!valid) {
    return res.status(400).json({ error: 'Invalid code. Please try again.' });
  }
  await prisma.admin.update({ where: { id: admin.id }, data: { twoFactorEnabled: true } });
  await logAdminEvent({ adminId: admin.id, email: admin.email, event: '2fa_enabled', req });
  res.json({ message: 'Two-factor authentication is now enabled.', token: signAdminToken(admin) });
});

// Requires the current password (not just an existing session) so leaving a
// laptop unlocked isn't enough to strip 2FA off the account.
app.post('/api/admin/2fa/disable', requireAuth, adminLimiter, validate(twoFactorDisableSchema), async (req, res) => {
  const { password } = req.body;
  const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatches) {
    return res.status(400).json({ error: 'Incorrect password.' });
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { twoFactorEnabled: false, totpSecret: null },
  });
  await logAdminEvent({ adminId: admin.id, email: admin.email, event: '2fa_disabled', req });
  res.json({ message: 'Two-factor authentication is now disabled.' });
});

app.post('/api/admin/logout', requireAuth, adminLimiter, async (req, res) => {
  await logAdminEvent({ adminId: req.admin.id, email: req.admin.email, event: 'logout', req });
  res.json({ message: 'Logged out.' });
});

// Powers the admin dashboard sidebar (name/email shown at the bottom). This
// route didn't exist before even though the frontend was already calling
// it — every request 404'd, silently, so the sidebar never actually showed
// the signed-in admin's name/email.
app.get('/api/admin/me', requireAuth, adminLimiter, async (req, res) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    select: { id: true, email: true, name: true, twoFactorEnabled: true },
  });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  res.json(admin);
});

// ---------------------------------------------------------------------------
// Customer accounts — registration, login, profile, discount verification.
//
// Discount policy: a passenger's discount only counts if the person booking
// is logged in AND their account has discountStatus === 'verified' (an
// admin reviewed their uploaded ID once, on their profile). This is checked
// server-side in POST /api/bookings below — never trust the client's
// discount_type on its own.
// ---------------------------------------------------------------------------

app.post('/api/register', loginLimiter, validate(registerSchema), async (req, res) => {
  const {
    first_name, middle_name, last_name, suffix,
    barangay, city_municipality, province, zip_code, region,
    email, password, contact_number,
  } = req.body;

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = generateEmailVerificationToken();
  const customer = await prisma.customer.create({
    data: {
      firstName: first_name,
      middleName: middle_name || null,
      lastName: last_name,
      suffix: suffix || null,
      email,
      passwordHash,
      contactNumber: contact_number,
      barangay,
      cityMunicipality: city_municipality,
      province,
      zipCode: zip_code,
      region,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Fire-and-forget — sendVerificationEmail never throws, so a mail
  // provider hiccup doesn't stop the account from being created. The
  // customer can always hit "Resend verification email" from their account.
  sendVerificationEmail(customer.email, customer.firstName, verificationToken);

  const token = signCustomerToken(customer);
  res.json({ message: 'Account created', token, customer: publicCustomer(customer) });
});

app.get('/api/verify-email', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) {
    return res.status(400).json({ error: 'Missing verification token' });
  }

  const customer = await prisma.customer.findFirst({ where: { emailVerificationToken: token } });
  if (!customer) {
    return res.status(400).json({ error: 'This verification link is invalid or was already used.' });
  }
  if (!customer.emailVerificationExpires || customer.emailVerificationExpires < new Date()) {
    return res.status(400).json({ error: 'This verification link has expired. Request a new one from your account page.' });
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { emailVerified: true, emailVerificationToken: null, emailVerificationExpires: null },
  });

  res.json({ message: 'Email verified' });
});

app.post('/api/customer/resend-verification', requireCustomerAuth, writeLimiter, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.customerId } });
  if (!customer) return res.status(404).json({ error: 'Account not found' });
  if (customer.emailVerified) {
    return res.json({ message: 'Your email is already verified.' });
  }

  const verificationToken = generateEmailVerificationToken();
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  sendVerificationEmail(customer.email, customer.firstName, verificationToken);

  res.json({ message: 'Verification email sent — check your inbox.' });
});

app.post('/api/customer/login', loginLimiter, validate(customerLoginSchema), async (req, res) => {
  const { email, password } = req.body;

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }
  const passwordMatches = await bcrypt.compare(password, customer.passwordHash);
  if (!passwordMatches) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const token = signCustomerToken(customer);
  res.json({ message: 'Login successful', token, customer: publicCustomer(customer) });
});

app.get('/api/customer/me', requireCustomerAuth, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.customerId } });
  if (!customer) return res.status(404).json({ error: 'Account not found' });
  res.json({ customer: publicCustomer(customer) });
});

// The live selfie captured during Profile Verification doubles as the
// account's permanent profile photo. Deliberately ignores any path/filename
// from the client — it only ever serves the authenticated customer's own
// selfiePath, so there's no way to request anyone else's file through this.
app.get('/api/customer/me/photo', requireCustomerAuth, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.customerId } });
  if (!customer?.selfiePath) {
    return res.status(404).json({ error: 'No profile photo yet' });
  }
  const filePath = path.join(uploadsDir, customer.selfiePath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'No profile photo yet' });
  }
  res.sendFile(filePath);
});

app.patch('/api/customer/me', requireCustomerAuth, writeLimiter, validate(updateProfileSchema), async (req, res) => {
  const {
    first_name, middle_name, last_name, suffix,
    barangay, city_municipality, province, zip_code, region,
    contact_number,
  } = req.body;

  const customer = await prisma.customer.update({
    where: { id: req.customerId },
    data: {
      firstName: first_name,
      middleName: middle_name || null,
      lastName: last_name,
      suffix: suffix || null,
      barangay,
      cityMunicipality: city_municipality,
      province,
      zipCode: zip_code,
      region,
      contactNumber: contact_number || undefined, // contactNumber is required — skip the update if left blank
    },
  });
  res.json({ message: 'Profile updated', customer: publicCustomer(customer) });
});

// Only ever returns bookings tied to the authenticated customer's own ID —
// never trusts an email/reference-code from the client the way the guest
// "Manage Booking" lookup does.
app.get('/api/customer/bookings', requireCustomerAuth, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { customerId: req.customerId },
    include: { schedule: true, passengers: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings);
});

app.post(
  '/api/customer/discount-request',
  requireCustomerAuth,
  writeLimiter,
  uploadVerificationFiles.fields([
    { name: 'discount_id', maxCount: 1 },
    { name: 'discount_id_back', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  validate(discountRequestSchema),
  async (req, res) => {
    const { discount_type } = req.body;
    const idFile = req.files?.discount_id?.[0];
    const idBackFile = req.files?.discount_id_back?.[0];
    const selfieFile = req.files?.selfie?.[0];
    if (!idFile) {
      return res.status(400).json({ error: 'Please upload a photo of the front of your ID' });
    }
    if (!idBackFile) {
      return res.status(400).json({ error: 'Please upload a photo of the back of your ID' });
    }
    if (!selfieFile) {
      return res.status(400).json({ error: 'A live selfie is required for verification' });
    }

    await prisma.customer.update({
      where: { id: req.customerId },
      data: {
        discountType: discount_type,
        discountIdPath: `discount-ids/${idFile.filename}`,
        discountIdBackPath: `discount-ids/${idBackFile.filename}`,
        selfiePath: `selfies/${selfieFile.filename}`,
        discountStatus: 'pending',
      },
    });

    res.json({ message: 'Submitted for verification. This can take a little while — check back on your account page.' });
  }
);

// ---------------------------------------------------------------------------
// Public: ferries & schedules
// ---------------------------------------------------------------------------

app.get('/api/ferries', async (req, res) => {
  const ferries = await prisma.ferry.findMany();
  res.json(ferries);
});

app.get('/api/schedules', validate(schedulesQuerySchema, 'query'), async (req, res) => {
  const { direction, date } = req.query;
  const startOfDay = new Date(`${date}T00:00:00`);
  const endOfDay = new Date(`${date}T23:59:59`);

  const schedules = await prisma.schedule.findMany({
    where: {
      direction,
      departureDatetime: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { departureDatetime: 'asc' },
  });
  res.json(schedules);
});

// ---------------------------------------------------------------------------
// Guest bookings (no login required, no seat selection)
//
// Guest checkout has no account, so there's no persistent "verified" flag to
// check the way logged-in customers have. Instead the email is verified
// live, right before booking: a 6-digit code is emailed to it, and
// confirming that code back returns a short-lived JWT scoped to that exact
// address, which the frontend then attaches to the actual booking request.
// ---------------------------------------------------------------------------

app.post('/api/guest/send-code', guestCodeLimiter, validate(guestSendCodeSchema), async (req, res) => {
  const { email } = req.body;
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);

  // Old, unverified codes for this email are irrelevant once a new one is
  // issued — only the latest should be checkable.
  await prisma.guestEmailVerification.deleteMany({ where: { email, verified: false } });
  await prisma.guestEmailVerification.create({
    data: { email, codeHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  try {
    await sendGuestVerificationCode(email, code);
  } catch (err) {
    console.error('Failed to send guest verification code:', err);
    return res.status(502).json({ error: "Couldn't send the verification email. Please try again shortly." });
  }

  res.json({ message: 'Verification code sent — check your inbox.' });
});

app.post('/api/guest/verify-code', guestCodeLimiter, validate(guestVerifyCodeSchema), async (req, res) => {
  const { email, code } = req.body;

  const record = await prisma.guestEmailVerification.findFirst({
    where: { email, verified: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ error: 'This code has expired. Request a new one.' });
  }
  if (record.attempts >= 5) {
    return res.status(400).json({ error: 'Too many incorrect attempts. Request a new code.' });
  }

  const matches = await bcrypt.compare(code, record.codeHash);
  if (!matches) {
    await prisma.guestEmailVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return res.status(400).json({ error: 'Incorrect code. Please try again.' });
  }

  await prisma.guestEmailVerification.update({ where: { id: record.id }, data: { verified: true } });

  // Short-lived and scoped to exactly this email — POST /api/bookings checks
  // both the role and that the email matches before trusting it.
  const token = jwt.sign({ email, role: 'guest_verified' }, process.env.JWT_SECRET, { expiresIn: '30m' });
  res.json({ message: 'Email verified.', token });
});

// Contact Us page submission — delivered straight to support's inbox via
// Resend (reply-to set to the visitor's own address), so visitors never have
// to leave the site or open their own email app to reach us.
app.post('/api/contact', contactLimiter, validate(contactMessageSchema), async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await sendContactMessage({ name, email, message });
  } catch (err) {
    console.error('Failed to send contact message:', err);
    return res.status(502).json({ error: "Couldn't send your message. Please try again shortly." });
  }
  res.json({ message: "Message sent — we'll get back to you soon." });
});

app.post('/api/bookings', writeLimiter, attachCustomerIfPresent, validate(createBookingSchema), async (req, res) => {
  const { schedule_id, contact_email, contact_number, passengers, guest_verification_token } = req.body;

  const schedule = await prisma.schedule.findUnique({ where: { id: schedule_id } });
  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  if (schedule.departureDatetime < new Date()) {
    return res.status(400).json({ error: 'This trip has already departed and can no longer be booked.' });
  }

  // Email verification enforcement — a logged-in customer's account works
  // immediately even before its email is verified, and guest checkout has no
  // account at all, so neither path required proving you actually own the
  // email address. A made-up address worked just as well as a real one
  // either way. This is the actual enforcement point for both, plus the
  // usual server-side discount enforcement for logged-in bookers (never
  // trust discount_type from the client — it only survives if the booker is
  // logged in with a verified profile, for the discount type that profile
  // was verified for).
  let allowedDiscountType = null;
  if (req.customerId) {
    // Logged in: block on the account's own emailVerified flag (set once,
    // via the link sent at registration).
    const customer = await prisma.customer.findUnique({ where: { id: req.customerId } });
    if (customer && !customer.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before booking. Check your inbox for the verification link, or resend it from your account page.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    if (customer && customer.discountStatus === 'verified' && !isDiscountExpired(customer)) {
      allowedDiscountType = customer.discountType;
    }
  } else {
    // Guest: block unless they completed the one-time-code flow for this
    // exact email and are presenting the token it issued. Re-verifies the
    // token here rather than trusting a prior /guest/verify-code response
    // blindly — the token could be stale, for a different email, or forged.
    let guestPayload = null;
    try {
      guestPayload = guest_verification_token && jwt.verify(guest_verification_token, process.env.JWT_SECRET);
    } catch {
      guestPayload = null;
    }
    const verified = guestPayload
      && guestPayload.role === 'guest_verified'
      && guestPayload.email.toLowerCase() === contact_email.toLowerCase();
    if (!verified) {
      return res.status(403).json({
        error: 'Please verify your email before booking as a guest.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
  }
  const sanitizedPassengers = passengers.map((p) => ({
    ...p,
    discount_type: p.discount_type === allowedDiscountType ? p.discount_type : 'none',
  }));

  const referenceCode = generateReferenceCode();
  const passengersWithFare = sanitizedPassengers.map((p) => ({
    ...p,
    fare: calculateFare(schedule, p.discount_type),
  }));
  const totalFare = passengersWithFare.reduce((sum, p) => sum + p.fare, 0);

  const booking = await prisma.booking.create({
    data: {
      scheduleId: schedule_id,
      referenceCode,
      contactEmail: contact_email,
      contactNumber: contact_number,
      totalFare,
      // Tags the booking to the logged-in customer, if any, so it shows up
      // in their dashboard's booking history. Guests (no token) leave this null.
      customerId: req.customerId || null,
      passengers: {
        create: passengersWithFare.map((p) => ({
          firstName: p.first_name,
          middleName: p.middle_name || null,
          lastName: p.last_name,
          suffix: p.suffix || null,
          sex: p.sex,
          nationality: p.nationality,
          barangay: p.barangay,
          cityMunicipality: p.city_municipality,
          province: p.province,
          zipCode: p.zip_code,
          country: p.country,
          email: p.email || null,
          contactNumber: p.contact_number,
          discountType: p.discount_type,
          fare: p.fare,
        })),
      },
    },
    include: { passengers: true },
  });

  res.json({ message: 'Booking created', booking });
});

app.get('/api/bookings/lookup', validate(lookupQuerySchema, 'query'), async (req, res) => {
  const { reference_code, contact_email } = req.query;

  const booking = await prisma.booking.findUnique({
    where: { referenceCode: reference_code },
    include: { passengers: true, schedule: { include: { ferry: true } } },
  });

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (booking.contactEmail.toLowerCase() !== contact_email.toLowerCase()) {
    return res.status(403).json({ error: 'Reference code and email do not match' });
  }

  res.json(booking);
});

app.post('/api/bookings/cancel', writeLimiter, validate(cancelBookingSchema), async (req, res) => {
  const { reference_code, contact_email, reason } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { referenceCode: reference_code },
    include: { schedule: true },
  });
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (booking.contactEmail.toLowerCase() !== contact_email.toLowerCase()) {
    return res.status(403).json({ error: 'Reference code and email do not match' });
  }
  if (['cancelled', 'refund_requested', 'refunded'].includes(booking.status)) {
    return res.status(400).json({ error: 'This booking has already been cancelled.' });
  }

  // Cancellation window is 24 hours from when the booking was PURCHASED,
  // not how far away departure is — a deliberate policy choice so a
  // last-minute booking can still be cancelled shortly after it's made.
  const hoursSincePurchase = (Date.now() - booking.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursSincePurchase > 24) {
    return res.status(400).json({ error: 'Cancellations must be requested within 24 hours of booking.' });
  }

  // No money has changed hands yet for an unpaid booking, so there's
  // nothing for an admin to refund — cancel it outright instead of putting
  // it in the manual refund-review queue.
  const noPaymentTaken = booking.status === 'pending_payment' || booking.status === 'payment_declined';

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: noPaymentTaken ? 'cancelled' : 'refund_requested',
      cancellationReason: reason,
    },
  });

  res.json({
    message: noPaymentTaken
      ? 'Booking cancelled.'
      : "Cancellation request submitted. Our team will review it and process your refund.",
  });
});

// ---------------------------------------------------------------------------
// Automated payment: PayMongo QR Ph
// ---------------------------------------------------------------------------

app.post('/api/bookings/generate-payment', writeLimiter, validate(generatePaymentSchema), async (req, res) => {
  const { reference_code, contact_email } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { referenceCode: reference_code },
    include: { payment: true },
  });
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (booking.contactEmail.toLowerCase() !== contact_email.toLowerCase()) {
    return res.status(403).json({ error: 'Reference code and email do not match' });
  }
  if (booking.status !== 'pending_payment') {
    return res.status(400).json({ error: 'This booking is not awaiting payment' });
  }

  // Reuse an existing, still-valid QR instead of generating a new one on every click.
  if (
    booking.payment &&
    booking.payment.status === 'pending' &&
    booking.payment.expiresAt &&
    booking.payment.expiresAt > new Date()
  ) {
    return res.json({
      qrCodeImageUrl: booking.payment.qrCodeImageUrl,
      expiresAt: booking.payment.expiresAt,
    });
  }

  try {
    const amountInCentavos = Math.round(Number(booking.totalFare) * 100);
    const expirySeconds = 1800; // 30 minutes

    const intent = await paymongo.createPaymentIntent(
      amountInCentavos,
      `Evershine Booking ${booking.referenceCode}`
    );
    const paymentIntentId = intent.data.id;
    const clientKey = intent.data.attributes.client_key;

    const method = await paymongo.createQrPhPaymentMethod(expirySeconds);
    const paymentMethodId = method.data.id;

    const attached = await paymongo.attachPaymentMethod(paymentIntentId, paymentMethodId, clientKey);
    const imageUrl = attached.data.attributes.next_action?.code?.image_url;
    // Test-mode only: lets you simulate a scan/payment without touching a real
    // banking app. PayMongo does not return this field in live mode.
    const testUrl = attached.data.attributes.next_action?.code?.test_url || null;

    if (!imageUrl) {
      throw new Error('PayMongo did not return a QR code image');
    }

    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    const payment = await prisma.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        paymentIntentId,
        paymentMethodId,
        qrCodeImageUrl: imageUrl,
        amount: booking.totalFare,
        status: 'pending',
        expiresAt,
      },
      update: {
        paymentIntentId,
        paymentMethodId,
        qrCodeImageUrl: imageUrl,
        amount: booking.totalFare,
        status: 'pending',
        expiresAt,
        paidAt: null,
      },
    });

    res.json({ qrCodeImageUrl: payment.qrCodeImageUrl, expiresAt: payment.expiresAt, testUrl });
  } catch (err) {
    console.error('PayMongo error:', err.message);
    res.status(502).json({ error: 'Could not generate a payment QR code. Please try again.' });
  }
});

app.get('/api/bookings/payment-status', validate(paymentStatusQuerySchema, 'query'), async (req, res) => {
  const { reference_code, contact_email } = req.query;

  const booking = await prisma.booking.findUnique({
    where: { referenceCode: reference_code },
    include: { payment: true },
  });
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (booking.contactEmail.toLowerCase() !== contact_email.toLowerCase()) {
    return res.status(403).json({ error: 'Reference code and email do not match' });
  }
  if (!booking.payment) {
    return res.json({ status: 'not_started' });
  }

  // Already settled — no need to call PayMongo again.
  if (booking.payment.status === 'paid') {
    return res.json({ status: 'paid' });
  }

  if (booking.payment.expiresAt && booking.payment.expiresAt < new Date()) {
    if (booking.payment.status !== 'expired') {
      await prisma.payment.update({ where: { id: booking.payment.id }, data: { status: 'expired' } });
    }
    return res.json({ status: 'expired' });
  }

  try {
    const intent = await paymongo.getPaymentIntent(booking.payment.paymentIntentId);
    const paymongoStatus = intent.data.attributes.status;

    if (paymongoStatus === 'succeeded') {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: 'paid', paidAt: new Date() },
        }),
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'confirmed' },
        }),
      ]);
      return res.json({ status: 'paid' });
    }

    res.json({ status: 'awaiting_payment' });
  } catch (err) {
    console.error('PayMongo status check error:', err.message);
    res.status(502).json({ error: 'Could not check payment status right now.' });
  }
});

// ---------------------------------------------------------------------------
// Admin: ferries, schedules, bookings, manifest, analytics
// ---------------------------------------------------------------------------

app.post('/api/admin/ferries', requireAuth, adminLimiter, validate(addFerrySchema), async (req, res) => {
  const { name, seat_capacity } = req.body;
  const ferry = await prisma.ferry.create({
    data: { name, seatCapacity: seat_capacity },
  });
  res.json({ message: 'Ferry created', ferry });
});

app.post('/api/admin/schedules', requireAuth, adminLimiter, validate(addScheduleSchema), async (req, res) => {
  const {
    ferry_id, direction, departure_datetime, base_fare,
    senior_discount_percent, pwd_discount_percent, student_discount_percent,
  } = req.body;
  const schedule = await prisma.schedule.create({
    data: {
      ferryId: ferry_id,
      direction,
      departureDatetime: new Date(departure_datetime),
      baseFare: base_fare,
      seniorDiscountPercent: senior_discount_percent,
      pwdDiscountPercent: pwd_discount_percent,
      studentDiscountPercent: student_discount_percent,
    },
  });
  res.json({ message: 'Schedule created', schedule });
});

app.get('/api/admin/schedules', requireAuth, adminLimiter, async (req, res) => {
  const schedules = await prisma.schedule.findMany({
    include: { ferry: true },
    orderBy: { departureDatetime: 'asc' },
  });
  res.json(schedules);
});

app.get('/api/admin/bookings', requireAuth, adminLimiter, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    include: { passengers: true, schedule: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings);
});

// Refunds are never sent automatically — a customer's cancellation just
// queues the booking here with their stated reason. An admin reviews it and
// either confirms they've manually sent the money (mark-refunded) or
// decides the request doesn't hold up and reinstates the booking (reject).
app.get('/api/admin/refund-requests', requireAuth, adminLimiter, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { status: 'refund_requested' },
    include: { passengers: true, schedule: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(bookings);
});

app.post(
  '/api/admin/refund-requests/:id/mark-refunded',
  requireAuth,
  adminLimiter,
  validate(idParamSchema, 'params'),
  async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking || booking.status !== 'refund_requested') {
      return res.status(400).json({ error: 'This booking is not awaiting a refund.' });
    }
    await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'refunded', refundedAt: new Date() },
    });
    res.json({ message: 'Booking marked as refunded.' });
  }
);

app.post(
  '/api/admin/refund-requests/:id/reject',
  requireAuth,
  adminLimiter,
  validate(idParamSchema, 'params'),
  async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking || booking.status !== 'refund_requested') {
      return res.status(400).json({ error: 'This booking is not awaiting a refund.' });
    }
    // Denying the request means the cancellation itself didn't hold up —
    // reinstate the booking as confirmed rather than leaving it in limbo.
    await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'confirmed' },
    });
    res.json({ message: 'Refund request rejected — booking reinstated as confirmed.' });
  }
);

app.get('/api/admin/schedules/:id/manifest', requireAuth, adminLimiter, validate(idParamSchema, 'params'), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { scheduleId: req.params.id, status: { not: 'cancelled' } },
    include: { passengers: true },
  });
  const manifest = bookings.flatMap((b) => b.passengers);
  res.json(manifest);
});

app.get('/api/admin/analytics/monthly-sales', requireAuth, adminLimiter, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { status: 'confirmed' },
    select: { totalFare: true, createdAt: true },
  });
  const monthlyTotals = {};
  for (const booking of bookings) {
    const month = booking.createdAt.toISOString().slice(0, 7);
    if (!monthlyTotals[month]) monthlyTotals[month] = { revenue: 0, count: 0 };
    monthlyTotals[month].revenue += Number(booking.totalFare);
    monthlyTotals[month].count += 1;
  }
  const result = Object.entries(monthlyTotals)
    .map(([month, stats]) => ({ month, ...stats }))
    .sort((a, b) => a.month.localeCompare(b.month));
  res.json(result);
});

// Full customer directory — every registered account, verified or not, so
// admins can look up contact details (e.g. to send an invoice) without
// digging through bookings. Password hashes and verification photos are
// deliberately excluded; the Profile Verification tab already handles those.
app.get('/api/admin/customers', requireAuth, adminLimiter, async (req, res) => {
  const customers = await prisma.customer.findMany({
    select: {
      id: true, firstName: true, middleName: true, lastName: true, suffix: true,
      email: true, contactNumber: true,
      barangay: true, cityMunicipality: true, province: true, zipCode: true, region: true,
      discountType: true, discountStatus: true, discountVerifiedUntil: true,
      emailVerified: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(customers);
});

app.get('/api/admin/customers/pending-discounts', requireAuth, adminLimiter, async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { discountStatus: 'pending' },
    select: {
      id: true, firstName: true, lastName: true, email: true, contactNumber: true,
      discountType: true, discountIdPath: true, discountIdBackPath: true, selfiePath: true, createdAt: true,
    },
  });
  // Admin.jsx's Profile Verification tab still reads a single `.name` —
  // compute it here so that page doesn't need changes for this revision.
  res.json(customers.map((c) => ({ ...c, name: [c.firstName, c.lastName].filter(Boolean).join(' ') })));
});

app.post(
  '/api/admin/customers/:id/verify-discount',
  requireAuth,
  adminLimiter,
  validate(idParamSchema, 'params'),
  validate(verifyDiscountSchema),
  async (req, res) => {
    const { expires_at } = req.body;
    await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        discountStatus: 'verified',
        discountVerifiedUntil: new Date(`${expires_at}T23:59:59`),
      },
    });
    res.json({ message: 'Discount verified' });
  }
);

app.post('/api/admin/customers/:id/reject-discount', requireAuth, adminLimiter, validate(idParamSchema, 'params'), async (req, res) => {
  await prisma.customer.update({
    where: { id: req.params.id },
    data: { discountStatus: 'rejected', discountVerifiedUntil: null },
  });
  res.json({ message: 'Discount rejected' });
});

// ---------------------------------------------------------------------------
// Admin-only file access (discount IDs, verification selfies)
// ---------------------------------------------------------------------------

app.get('/api/admin/uploads/:folder/:filename', requireAuth, (req, res) => {
  const { folder, filename } = req.params;
  if (!['discount-ids', 'selfies'].includes(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }
  const safeName = path.basename(filename);
  const filePath = path.join(uploadsDir, folder, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});

// ---------------------------------------------------------------------------

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.startsWith('Only JPEG')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});