require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
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
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
authenticator.options = { window: 1 };

const prisma = require('./lib/prisma');
const { requireAuth, requireAdminOrSetup, requireAdminOrCoastGuard } = require('./middleware/auth');
const validate = require('./middleware/validate');
const paymongo = require('./lib/paymongo');
const { sendVerificationEmail, sendGuestVerificationCode, sendContactMessage, sendBookingInvoice, sendManifestEmail } = require('./lib/email');
const { generateInvoicePdf } = require('./lib/pdfInvoice');
const { generateManifestPdf } = require('./lib/pdfManifest');
const { getWeather } = require('./lib/weather');
const { getPagasaBulletin } = require('./lib/pagasaBulletin');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());


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
            await sendInvoiceForBooking(payment.bookingId);
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

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));


const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const COAST_GUARD_CHAT_ROOM = 'coastguard-chat';



const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  
  skip: (req) => Boolean(req.headers.authorization),
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
 
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.admin?.id || 'unknown'}`,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});


const guestCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body?.email || '').trim().toLowerCase() || ipKeyGenerator(req.ip),
  message: { error: 'Too many verification codes requested for this email. Please wait 15 minutes and try again.' },
});


const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please wait a while and try again.' },
});

app.use('/api', publicLimiter);


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

const upcomingDatesQuerySchema = z.object({
  direction: z.enum(['PB_TO_LIMASAWA', 'LIMASAWA_TO_PB']),
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
 
  senior_discount_percent: z.coerce.number().min(0).max(100).default(20),
  pwd_discount_percent: z.coerce.number().min(0).max(100).default(20),
  student_discount_percent: z.coerce.number().min(0).max(100).default(20),
}).strict();


const editScheduleSchema = z.object({
  ferry_id: z.string().uuid().optional(),
  direction: z.enum(['PB_TO_LIMASAWA', 'LIMASAWA_TO_PB']).optional(),
  departure_datetime: z.string().min(1).max(30).optional(),
  base_fare: z.coerce.number().positive().max(100000).optional(),
  senior_discount_percent: z.coerce.number().min(0).max(100).optional(),
  pwd_discount_percent: z.coerce.number().min(0).max(100).optional(),
  student_discount_percent: z.coerce.number().min(0).max(100).optional(),
}).strict();

const idParamSchema = z.object({ id: z.string().uuid() }).strict();

const addCoastGuardAccountSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(100),
  station: z.string().trim().min(1).max(100),
}).strict();

const coastGuardMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict();

const coastGuardMessagesQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

const sendManifestSchema = z.object({
  coastGuardAccountIds: z.array(z.string().uuid()).max(20).optional().default([]),
  extraEmail: z.string().trim().email().max(255).optional(),
}).strict();


const VAT_RATE = 0.12;

const VAT_EXEMPT_DISCOUNT_TYPES = ['senior', 'pwd'];
const round2 = (n) => Math.round(n * 100) / 100;

function calculateFare(schedule, discountType) {
  const base = Number(schedule.baseFare);
  const percentByType = {
    senior: schedule.seniorDiscountPercent,
    pwd: schedule.pwdDiscountPercent,
    student: schedule.studentDiscountPercent,
  };
  const percent = percentByType[discountType];
  const net = round2(percent != null ? base * (1 - Number(percent) / 100) : base);
  const vat = VAT_EXEMPT_DISCOUNT_TYPES.includes(discountType) ? 0 : round2(net * VAT_RATE);
  return { net, vat, total: round2(net + vat) };
}

function seatHoldingWhere() {
  return {
    OR: [
      { status: 'confirmed' },
      {
        status: 'pending_payment',
        OR: [{ payment: null }, { payment: { expiresAt: { gt: new Date() } } }],
      },
    ],
  };
}


const MANIFEST_EXCLUDED_STATUSES = ['cancelled', 'refund_requested', 'refunded', 'payment_declined'];


async function getBookedSeatCount(client, scheduleId) {
  const rows = await client.booking.findMany({
    where: { scheduleId, ...seatHoldingWhere() },
    select: { _count: { select: { passengers: true } } },
  });
  return rows.reduce((sum, r) => sum + r._count.passengers, 0);
}


async function getBookedSeatCountsForSchedules(client, scheduleIds) {
  if (scheduleIds.length === 0) return {};
  const rows = await client.booking.findMany({
    where: { scheduleId: { in: scheduleIds }, ...seatHoldingWhere() },
    select: { scheduleId: true, _count: { select: { passengers: true } } },
  });
  const counts = {};
  for (const r of rows) {
    counts[r.scheduleId] = (counts[r.scheduleId] || 0) + r._count.passengers;
  }
  return counts;
}

function computeRefundEligibility(departureDatetime) {
  const hoursUntilDeparture = (new Date(departureDatetime).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilDeparture <= 0) {
    return { eligible: false, percent: null, reason: 'Cancellations are not accepted once the scheduled departure has passed.' };
  }
  if (hoursUntilDeparture > 24) {
    return { eligible: true, percent: 80 };
  }
  return { eligible: true, percent: 60 };
}

function generateReferenceCode() {

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'EB';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

async function sendInvoiceForBooking(bookingId) {
  const fullBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { passengers: true, schedule: { include: { ferry: true } } },
  });
  if (fullBooking) {
    await sendBookingInvoice(fullBooking);
  }
}


async function persistCoastGuardMessage(senderId, body) {
  const sender = await prisma.admin.findUnique({ where: { id: senderId } });
  if (!sender) return null;
  return prisma.coastGuardMessage.create({
    data: {
      senderId: sender.id,
      senderName: sender.name || sender.email,
      senderRole: sender.role,
      senderStation: sender.coastGuardStation,
      body,
    },
  });
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
    { id: admin.id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

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

async function logAdminEvent({ adminId = null, email, event, req }) {
  try {
    await prisma.adminAuditLog.create({
      data: { adminId, email, event, ipAddress: req.ip },
    });
  } catch (err) {
    console.error('Failed to write admin audit log:', err);
  }
}

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
    createdAt: customer.createdAt,
  };
}

function generateEmailVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}


function generateSixDigitCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

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


function attachCustomerIfPresent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      if (payload.role === 'customer') req.customerId = payload.customerId;
    } catch {
    }
  }
  next();
}


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

  if (admin.twoFactorEnabled) {
    return res.json({
      requiresTwoFactor: true,
      pendingToken: signAdminPendingToken(admin),
    });
  }

  
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
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      twoFactorEnabled: admin.twoFactorEnabled,
      role: admin.role,
      coastGuardStation: admin.coastGuardStation,
    },
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
  res.json({
    message: 'Two-factor authentication is now enabled.',
    token: signAdminToken(admin),
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      twoFactorEnabled: true,
      role: admin.role,
      coastGuardStation: admin.coastGuardStation,
    },
  });
});


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

app.get('/api/admin/me', requireAuth, adminLimiter, async (req, res) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    select: { id: true, email: true, name: true, twoFactorEnabled: true },
  });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  res.json(admin);
});



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
      contactNumber: contact_number || undefined, 
    },
  });
  res.json({ message: 'Profile updated', customer: publicCustomer(customer) });
});


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
    include: { ferry: true },
    orderBy: { departureDatetime: 'asc' },
  });
  const bookedCounts = await getBookedSeatCountsForSchedules(prisma, schedules.map((s) => s.id));
  const withAvailability = schedules.map((s) => {
    const booked = bookedCounts[s.id] || 0;
    return { ...s, availableSeats: Math.max(0, s.ferry.seatCapacity - booked) };
  });
  res.json(withAvailability);
});


app.get('/api/schedules/upcoming-dates', validate(upcomingDatesQuerySchema, 'query'), async (req, res) => {
  const { direction } = req.query;
  const schedules = await prisma.schedule.findMany({
    where: { direction, departureDatetime: { gte: new Date() } },
    select: { departureDatetime: true },
    orderBy: { departureDatetime: 'asc' },
  });
  const seen = new Set();
  const dates = [];
  for (const s of schedules) {
    
    const dateStr = s.departureDatetime.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    if (!seen.has(dateStr)) {
      seen.add(dateStr);
      dates.push(dateStr);
    }
  }
  res.json(dates.slice(0, 30));
});


app.post('/api/guest/send-code', guestCodeLimiter, validate(guestSendCodeSchema), async (req, res) => {
  const { email } = req.body;
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);


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

  res.json({ message: 'Verification code sent, check your inbox.' });
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

  
  const token = jwt.sign({ email, role: 'guest_verified' }, process.env.JWT_SECRET, { expiresIn: '30m' });
  res.json({ message: 'Email verified.', token });
});


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

  let allowedDiscountType = null;
  if (req.customerId) {
  
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
  const totalFare = round2(passengersWithFare.reduce((sum, p) => sum + p.fare.total, 0));
  const vatAmount = round2(passengersWithFare.reduce((sum, p) => sum + p.fare.vat, 0));

  
  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      
      await tx.$queryRaw`SELECT id FROM schedules WHERE id = ${schedule_id} FOR UPDATE`;
      const ferry = await tx.ferry.findUnique({ where: { id: schedule.ferryId } });
      const bookedSeats = await getBookedSeatCount(tx, schedule_id);
      const requestedSeats = passengersWithFare.length;
      if (bookedSeats + requestedSeats > ferry.seatCapacity) {
        const remaining = Math.max(0, ferry.seatCapacity - bookedSeats);
        const err = new Error(
          remaining === 0
            ? 'This sailing is fully booked.'
            : `Only ${remaining} seat${remaining === 1 ? '' : 's'} left on this sailing.`
        );
        err.code = 'NOT_ENOUGH_SEATS';
        throw err;
      }

      return tx.booking.create({
        data: {
          scheduleId: schedule_id,
          referenceCode,
          contactEmail: contact_email,
          contactNumber: contact_number,
          totalFare,
          vatAmount,
     
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
              fare: p.fare.total,
            })),
          },
        },
        include: { passengers: true },
      });
    });
  } catch (err) {
    if (err.code === 'NOT_ENOUGH_SEATS') {
      return res.status(409).json({ error: err.message, code: 'NOT_ENOUGH_SEATS' });
    }
    throw err;
  }

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


app.get('/api/bookings/invoice-pdf', validate(lookupQuerySchema, 'query'), async (req, res) => {
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
 
  if (booking.status !== 'confirmed') {
    return res.status(400).json({ error: 'This booking is not confirmed yet, so there is no invoice to download.' });
  }

  try {
    const pdfBuffer = await generateInvoicePdf(booking);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="evershine-invoice-${booking.referenceCode}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Failed to generate invoice PDF:', err);
    res.status(500).json({ error: 'Could not generate the invoice PDF. Please try again.' });
  }
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


  const noPaymentTaken = booking.status === 'pending_payment' || booking.status === 'payment_declined';

  let refundPercent = null;
  if (!noPaymentTaken) {
    const eligibility = computeRefundEligibility(booking.schedule.departureDatetime);
    if (!eligibility.eligible) {
      return res.status(400).json({ error: eligibility.reason });
    }
    refundPercent = eligibility.percent;
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: noPaymentTaken ? 'cancelled' : 'refund_requested',
      cancellationReason: reason,
      refundPercent,
    },
  });

  res.json({
    message: noPaymentTaken
      ? 'Booking cancelled.'
      : `Cancellation request submitted. You're eligible for a ${refundPercent}% refund — our team will review it and process your refund once approved.`,
  });
});


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
      await sendInvoiceForBooking(booking.id);
      return res.json({ status: 'paid' });
    }

    res.json({ status: 'awaiting_payment' });
  } catch (err) {
    console.error('PayMongo status check error:', err.message);
    res.status(502).json({ error: 'Could not check payment status right now.' });
  }
});


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


app.patch(
  '/api/admin/schedules/:id',
  requireAuth,
  adminLimiter,
  validate(idParamSchema, 'params'),
  validate(editScheduleSchema),
  async (req, res) => {
    const existing = await prisma.schedule.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    const {
      ferry_id, direction, departure_datetime, base_fare,
      senior_discount_percent, pwd_discount_percent, student_discount_percent,
    } = req.body;

    if (ferry_id) {
      const ferry = await prisma.ferry.findUnique({ where: { id: ferry_id } });
      if (!ferry) {
        return res.status(400).json({ error: 'Ferry not found' });
      }
    }

    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: {
        ...(ferry_id !== undefined && { ferryId: ferry_id }),
        ...(direction !== undefined && { direction }),
        ...(departure_datetime !== undefined && { departureDatetime: new Date(departure_datetime) }),
        ...(base_fare !== undefined && { baseFare: base_fare }),
        ...(senior_discount_percent !== undefined && { seniorDiscountPercent: senior_discount_percent }),
        ...(pwd_discount_percent !== undefined && { pwdDiscountPercent: pwd_discount_percent }),
        ...(student_discount_percent !== undefined && { studentDiscountPercent: student_discount_percent }),
      },
      include: { ferry: true },
    });
    res.json({ message: 'Schedule updated', schedule });
  }
);


app.get('/api/admin/schedules', requireAdminOrCoastGuard, adminLimiter, async (req, res) => {
  const schedules = await prisma.schedule.findMany({
    include: { ferry: true },
    orderBy: { departureDatetime: 'asc' },
  });
  const bookedCounts = await getBookedSeatCountsForSchedules(prisma, schedules.map((s) => s.id));
  const withAvailability = schedules.map((s) => {
    const booked = bookedCounts[s.id] || 0;
    return { ...s, bookedSeats: booked, availableSeats: Math.max(0, s.ferry.seatCapacity - booked) };
  });
  res.json(withAvailability);
});


app.post(
  '/api/admin/coastguard-accounts',
  requireAuth,
  adminLimiter,
  validate(addCoastGuardAccountSchema),
  async (req, res) => {
    const { email, password, name, station } = req.body;
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const account = await prisma.admin.create({
      data: { email, passwordHash, name, role: 'coast_guard', coastGuardStation: station },
    });
    await logAdminEvent({ adminId: req.admin.id, email: req.admin.email, event: `coastguard_account_created:${email}`, req });
    res.json({
      message: 'Coast Guard account created. 2FA setup is required the first time they log in, same as any admin account.',
      account: { id: account.id, email: account.email, name: account.name, coastGuardStation: account.coastGuardStation },
    });
  }
);

app.get('/api/admin/coastguard-accounts', requireAuth, adminLimiter, async (req, res) => {
  const accounts = await prisma.admin.findMany({
    where: { role: 'coast_guard' },
    select: { id: true, email: true, name: true, coastGuardStation: true, twoFactorEnabled: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(accounts);
});


app.get('/api/admin/coastguard/me', requireAdminOrCoastGuard, adminLimiter, async (req, res) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    select: { id: true, email: true, name: true, role: true, coastGuardStation: true },
  });
  if (!admin) return res.status(404).json({ error: 'Account not found' });
  res.json(admin);
});


app.get(
  '/api/admin/coastguard/messages',
  requireAdminOrCoastGuard,
  adminLimiter,
  validate(coastGuardMessagesQuerySchema, 'query'),
  async (req, res) => {
    const { before, limit } = req.query;
    const messages = await prisma.coastGuardMessage.findMany({
      where: before ? { createdAt: { lt: new Date(before) } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit || 50,
    });
    res.json(messages.reverse());
  }
);


app.post(
  '/api/admin/coastguard/messages',
  requireAdminOrCoastGuard,
  writeLimiter,
  validate(coastGuardMessageSchema),
  async (req, res) => {
    const message = await persistCoastGuardMessage(req.admin.id, req.body.body);
    if (!message) return res.status(404).json({ error: 'Account not found' });
    io.to(COAST_GUARD_CHAT_ROOM).emit('new_message', message);
    res.json(message);
  }
);


app.post('/api/admin/coastguard/mark-read', requireAdminOrCoastGuard, adminLimiter, async (req, res) => {
  await prisma.admin.update({
    where: { id: req.admin.id },
    data: { coastGuardChatLastReadAt: new Date() },
  });
  res.json({ message: 'Marked as read.' });
});


app.delete('/api/admin/schedules/:id', requireAuth, adminLimiter, validate(idParamSchema, 'params'), async (req, res) => {
  const schedule = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  const bookingCount = await prisma.booking.count({ where: { scheduleId: req.params.id } });
  if (bookingCount > 0) {
    return res.status(400).json({
      error: `Cannot delete this schedule: ${bookingCount} booking${bookingCount === 1 ? '' : 's'} already reference it.`,
    });
  }
  await prisma.schedule.delete({ where: { id: req.params.id } });
  res.json({ message: 'Schedule deleted' });
});

app.get('/api/admin/bookings', requireAuth, adminLimiter, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    include: { passengers: true, schedule: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings);
});


app.post(
  '/api/admin/bookings/:id/cancel',
  requireAuth,
  adminLimiter,
  validate(idParamSchema, 'params'),
  async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (booking.status === 'cancelled' || booking.status === 'refunded') {
      return res.status(400).json({ error: 'This booking is already cancelled or refunded.' });
    }
   
    const noPaymentTaken = booking.status === 'pending_payment' || booking.status === 'payment_declined';
   
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        status: noPaymentTaken ? 'cancelled' : 'refund_requested',
        cancellationReason: booking.cancellationReason || 'Cancelled by admin.',
        refundPercent: noPaymentTaken ? null : 100,
      },
    });
    res.json({ message: 'Booking cancelled.', booking: updated });
  }
);

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
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { passengers: { select: { id: true } }, schedule: { include: { ferry: true } } },
    });
    if (!booking || booking.status !== 'refund_requested') {
      return res.status(400).json({ error: 'This booking is not awaiting a refund.' });
    }
    
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM schedules WHERE id = ${booking.scheduleId} FOR UPDATE`;
        const bookedSeats = await getBookedSeatCount(tx, booking.scheduleId);
        if (bookedSeats + booking.passengers.length > booking.schedule.ferry.seatCapacity) {
          const err = new Error(
            "The seats from this booking have since been taken by other passengers, so it can't be reinstated. Mark it as refunded instead, or free up seats first."
          );
          err.code = 'NOT_ENOUGH_SEATS';
          throw err;
        }
        await tx.booking.update({
          where: { id: req.params.id },
          data: { status: 'confirmed', refundPercent: null },
        });
      });
    } catch (err) {
      if (err.code === 'NOT_ENOUGH_SEATS') return res.status(409).json({ error: err.message });
      throw err;
    }
    res.json({ message: 'Refund request rejected, booking reinstated as confirmed.' });
  }
);

app.get('/api/admin/schedules/:id/manifest', requireAuth, adminLimiter, validate(idParamSchema, 'params'), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { scheduleId: req.params.id, status: { notIn: MANIFEST_EXCLUDED_STATUSES } },
    include: { passengers: true },
  });
  const manifest = bookings.flatMap((b) => b.passengers);
  res.json(manifest);
});


app.post(
  '/api/admin/schedules/:id/manifest/send',
  requireAuth,
  adminLimiter,
  validate(idParamSchema, 'params'),
  validate(sendManifestSchema),
  async (req, res) => {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: { ferry: true },
    });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const { coastGuardAccountIds, extraEmail } = req.body;
    const recipients = [];
    if (coastGuardAccountIds.length > 0) {
      const cgAccounts = await prisma.admin.findMany({
        where: { id: { in: coastGuardAccountIds }, role: 'coast_guard' },
        select: { email: true },
      });
      recipients.push(...cgAccounts.map((a) => a.email));
    }
    if (extraEmail) recipients.push(extraEmail);
    const uniqueRecipients = [...new Set(recipients)];

    if (uniqueRecipients.length === 0) {
      return res.status(400).json({ error: 'Choose at least one recipient before sending.' });
    }

    const bookings = await prisma.booking.findMany({
      where: { scheduleId: schedule.id, status: { notIn: MANIFEST_EXCLUDED_STATUSES } },
      include: { passengers: true },
    });
    const passengers = bookings.flatMap((b) => b.passengers);

    try {
      const pdfBuffer = await generateManifestPdf(schedule, passengers);
      await sendManifestEmail(uniqueRecipients, schedule, pdfBuffer, passengers.length);
      await logAdminEvent({ adminId: req.admin.id, email: req.admin.email, event: 'manifest_sent', req });
  
      if (coastGuardAccountIds.length > 0) {
        await prisma.sentManifest.create({
          data: {
            scheduleId: schedule.id,
            sentByAdminId: req.admin.id,
            recipientAccountIds: coastGuardAccountIds,
            extraEmail: extraEmail || null,
          },
        });
      }
      res.json({
        message: `Manifest sent to ${uniqueRecipients.length} recipient${uniqueRecipients.length === 1 ? '' : 's'}.`,
        recipients: uniqueRecipients,
      });
    } catch (err) {
      console.error('Failed to send manifest:', err);
      res.status(500).json({ error: 'Could not send the manifest. Please try again.' });
    }
  }
);


app.get('/api/admin/coastguard/manifests', requireAdminOrCoastGuard, adminLimiter, async (req, res) => {
  const sent = await prisma.sentManifest.findMany({
    where: { recipientAccountIds: { has: req.admin.id } },
    include: { schedule: { include: { ferry: true } }, sentByAdmin: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(
    sent.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      sentByName: s.sentByAdmin?.name || s.sentByAdmin?.email || 'Evershine Admin',
      schedule: {
        id: s.schedule.id,
        direction: s.schedule.direction,
        departureDatetime: s.schedule.departureDatetime,
        ferry: s.schedule.ferry ? { name: s.schedule.ferry.name, seatCapacity: s.schedule.ferry.seatCapacity } : null,
      },
    }))
  );
});


app.get(
  '/api/admin/coastguard/manifests/:id/pdf',
  requireAdminOrCoastGuard,
  adminLimiter,
  validate(idParamSchema, 'params'),
  async (req, res) => {
    const sent = await prisma.sentManifest.findUnique({
      where: { id: req.params.id },
      include: { schedule: { include: { ferry: true } } },
    });
    if (!sent) return res.status(404).json({ error: 'Manifest not found' });
    if (req.admin.role !== 'admin' && !sent.recipientAccountIds.includes(req.admin.id)) {
      return res.status(403).json({ error: 'You do not have access to this manifest.' });
    }

    const bookings = await prisma.booking.findMany({
      where: { scheduleId: sent.scheduleId, status: { notIn: MANIFEST_EXCLUDED_STATUSES } },
      include: { passengers: true },
    });
    const passengers = bookings.flatMap((b) => b.passengers);

    try {
      const pdfBuffer = await generateManifestPdf(sent.schedule, passengers);
      const dateStr = new Date(sent.schedule.departureDatetime).toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="evershine-manifest-${dateStr}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('Failed to generate manifest PDF:', err);
      res.status(500).json({ error: 'Could not generate the manifest PDF. Please try again.' });
    }
  }
);

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


const accountingQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

app.get(
  '/api/admin/accounting',
  requireAuth,
  adminLimiter,
  async (req, res) => {
    
    const parsed = accountingQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Provide from and to as YYYY-MM-DD.' });
    }
    const { from, to } = parsed.data;
    const start = new Date(`${from}T00:00:00+08:00`);
    const end = new Date(`${to}T23:59:59.999+08:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ error: 'Invalid date range.' });
    }

    const refundAmounts = (b) => {
      const pct = b.refundPercent ?? 100;
      return {
        percent: pct,
        refundTotal: round2((Number(b.totalFare) * pct) / 100),
        refundVat: round2((Number(b.vatAmount) * pct) / 100),
      };
    };

    const [paidBookings, refundedBookings, pendingBookings] = await Promise.all([
      prisma.booking.findMany({
        where: { payment: { status: 'paid', paidAt: { gte: start, lte: end } } },
        include: { payment: true, passengers: { select: { discountType: true, fare: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.booking.findMany({
        where: { status: 'refunded', refundedAt: { gte: start, lte: end } },
        orderBy: { refundedAt: 'asc' },
      }),
      prisma.booking.findMany({
        where: { status: 'refund_requested' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const sales = paidBookings
      .map((b) => {
        const total = Number(b.totalFare);
        const vat = Number(b.vatAmount);
        const net = round2(total - vat);
        const exempt = round2(
          b.passengers
            .filter((p) => VAT_EXEMPT_DISCOUNT_TYPES.includes(p.discountType))
            .reduce((sum, p) => sum + Number(p.fare), 0)
        );
        return {
          id: b.id,
          referenceCode: b.referenceCode,
          paidAt: b.payment.paidAt,
          passengerCount: b.passengers.length,
          status: b.status,
          net,
          vat,
          total,
          exemptSales: exempt,
          vatableSales: round2(net - exempt),
        };
      })
      .sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt));

    const refunds = refundedBookings.map((b) => ({
      id: b.id,
      referenceCode: b.referenceCode,
      refundedAt: b.refundedAt,
      reason: b.cancellationReason,
      ...refundAmounts(b),
    }));

    const pendingRefunds = pendingBookings.map((b) => ({
      id: b.id,
      referenceCode: b.referenceCode,
      requestedAt: b.createdAt,
      reason: b.cancellationReason,
      ...refundAmounts(b),
    }));

    res.json({ from, to, sales, refunds, pendingRefunds });
  }
);


app.get('/api/admin/weather', requireAuth, adminLimiter, async (req, res) => {
  try {
    const weather = await getWeather();
    res.json(weather);
  } catch (err) {
    console.error('Failed to fetch weather:', err.message);
    res.status(502).json({ error: 'Could not reach the weather service. Please try again shortly.' });
  }
});


app.get('/api/admin/pagasa-bulletin', requireAuth, adminLimiter, async (req, res) => {
  try {
    const bulletin = await getPagasaBulletin();
    res.json(bulletin);
  } catch (err) {
    console.error('Failed to fetch PAGASA bulletin:', err.message);
    res.status(502).json({ error: "Could not reach PAGASA's site. Please try again shortly." });
  }
});


app.get('/api/admin/customers', requireAuth, adminLimiter, async (req, res) => {
  const customers = await prisma.customer.findMany({
    select: {
      id: true, firstName: true, middleName: true, lastName: true, suffix: true,
      email: true, contactNumber: true,
      barangay: true, cityMunicipality: true, province: true, zipCode: true, region: true,
      discountType: true, discountStatus: true, discountVerifiedUntil: true,
      emailVerified: true, createdAt: true,
      selfiePath: true,
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


io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Not logged in'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin' && payload.role !== 'coast_guard') {
      return next(new Error('Not logged in'));
    }
    socket.adminId = payload.id;
    socket.adminRole = payload.role;
    next();
  } catch {
    next(new Error('Session expired, please log in again'));
  }
});

io.on('connection', (socket) => {
  socket.join(COAST_GUARD_CHAT_ROOM);

  socket.on('send_message', async (data, ack) => {
    const result = coastGuardMessageSchema.safeParse(data);
    if (!result.success) {
      if (typeof ack === 'function') ack({ error: 'Message could not be sent.' });
      return;
    }
    try {
      const message = await persistCoastGuardMessage(socket.adminId, result.data.body);
      if (!message) {
        if (typeof ack === 'function') ack({ error: 'Account not found.' });
        return;
      }
      io.to(COAST_GUARD_CHAT_ROOM).emit('new_message', message);
      if (typeof ack === 'function') ack({ message });
    } catch (err) {
      console.error('Failed to persist coast guard message:', err);
      if (typeof ack === 'function') ack({ error: 'Message could not be sent.' });
    }
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.startsWith('Only JPEG')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});