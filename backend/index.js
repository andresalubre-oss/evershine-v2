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

const prisma = require('./lib/prisma');
const requireAuth = require('./middleware/auth');
const validate = require('./middleware/validate');
const paymongo = require('./lib/paymongo');

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

app.use('/api', publicLimiter);

// ---------------------------------------------------------------------------
// File uploads: local disk, randomized filenames, served only via an
// authenticated admin route (not a public static folder).
// ---------------------------------------------------------------------------

const uploadsDir = path.join(__dirname, 'uploads');
for (const sub of ['receipts', 'discount-ids', 'selfies']) {
  fs.mkdirSync(path.join(uploadsDir, sub), { recursive: true });
}

function makeStorage(subfolder) {
  return multer.diskStorage({
    destination: path.join(uploadsDir, subfolder),
    filename: (req, file, cb) => {
      const ext = file.mimetype.split('/')[1];
      const randomName = crypto.randomBytes(16).toString('hex');
      cb(null, `${randomName}.${ext}`);
    },
  });
}

const imageFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
  }
  cb(null, true);
};

const uploadReceipt = multer({
  storage: makeStorage('receipts'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const uploadDiscountId = multer({
  storage: makeStorage('discount-ids'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

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
  name: z.string().trim().min(1).max(100),
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
}).strict();

const refCodeField = z.string().trim().regex(/^EB[A-Z0-9]{6}$/, 'Invalid reference code format');

const lookupQuerySchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
}).strict();

const cancelBookingSchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
}).strict();

const uploadReceiptSchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
}).strict();

const uploadDiscountIdSchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
}).strict();

const generatePaymentSchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
}).strict();

const paymentStatusQuerySchema = z.object({
  reference_code: refCodeField,
  contact_email: z.string().trim().email().max(255),
}).strict();

const passengerIdParamSchema = z.object({ passengerId: z.string().uuid() }).strict();

const addFerrySchema = z.object({
  name: z.string().trim().min(1).max(100),
  seat_capacity: z.coerce.number().int().min(1).max(500),
}).strict();

const addScheduleSchema = z.object({
  ferry_id: z.string().uuid(),
  direction: z.enum(['PB_TO_LIMASAWA', 'LIMASAWA_TO_PB']),
  departure_datetime: z.string().min(1).max(30),
  base_fare: z.coerce.number().positive().max(100000),
}).strict();

const idParamSchema = z.object({ id: z.string().uuid() }).strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateFare(baseFare, discountType) {
  const base = Number(baseFare);
  if (discountType && discountType !== 'none') {
    return base * 0.8;
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

function deleteUploadedFileOnError(file) {
  if (file?.path) {
    fs.unlink(file.path, () => {});
  }
}

function signCustomerToken(customer) {
  return jwt.sign(
    { customerId: customer.id, email: customer.email, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
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
  };
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

app.post('/api/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatches) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.json({
    message: 'Login successful',
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name },
  });
});

app.get('/api/whoami', requireAuth, async (req, res) => {
  res.json({ message: 'You are logged in as:', admin: req.admin });
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
    },
  });

  const token = signCustomerToken(customer);
  res.json({ message: 'Account created', token, customer: publicCustomer(customer) });
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

app.patch('/api/customer/me', requireCustomerAuth, writeLimiter, validate(updateProfileSchema), async (req, res) => {
  const { name, contact_number } = req.body;
  // The Account dashboard's Edit Profile form still edits one "Name" field
  // (that page hasn't been revised to the structured name yet), so this
  // splits it best-effort on the first space. Revisit once that page is
  // rebuilt to edit firstName/middleName/lastName/suffix directly.
  const trimmed = name.trim();
  const spaceIndex = trimmed.indexOf(' ');
  const firstName = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
  const lastName = spaceIndex === -1 ? trimmed : trimmed.slice(spaceIndex + 1).trim() || trimmed;

  const customer = await prisma.customer.update({
    where: { id: req.customerId },
    data: {
      firstName,
      lastName,
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
    { name: 'selfie', maxCount: 1 },
  ]),
  validate(discountRequestSchema),
  async (req, res) => {
    const { discount_type } = req.body;
    const idFile = req.files?.discount_id?.[0];
    const selfieFile = req.files?.selfie?.[0];
    if (!idFile) {
      return res.status(400).json({ error: 'Please upload a photo of your ID' });
    }
    if (!selfieFile) {
      return res.status(400).json({ error: 'A live selfie is required for verification' });
    }

    await prisma.customer.update({
      where: { id: req.customerId },
      data: {
        discountType: discount_type,
        discountIdPath: `discount-ids/${idFile.filename}`,
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
// ---------------------------------------------------------------------------

app.post('/api/bookings', writeLimiter, attachCustomerIfPresent, validate(createBookingSchema), async (req, res) => {
  const { schedule_id, contact_email, contact_number, passengers } = req.body;

  const schedule = await prisma.schedule.findUnique({ where: { id: schedule_id } });
  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }

  // Server-side discount enforcement — never trust discount_type from the
  // client. It only survives if the booker is logged in with a verified
  // profile, and only for the discount type that profile was verified for.
  let allowedDiscountType = null;
  if (req.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: req.customerId } });
    if (customer && customer.discountStatus === 'verified' && !isDiscountExpired(customer)) {
      allowedDiscountType = customer.discountType;
    }
  }
  const sanitizedPassengers = passengers.map((p) => ({
    ...p,
    discount_type: p.discount_type === allowedDiscountType ? p.discount_type : 'none',
  }));

  const referenceCode = generateReferenceCode();
  const passengersWithFare = sanitizedPassengers.map((p) => ({
    ...p,
    fare: calculateFare(schedule.baseFare, p.discount_type),
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
  const { reference_code, contact_email } = req.body;

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

  const hoursUntilDeparture = (booking.schedule.departureDatetime - new Date()) / (1000 * 60 * 60);
  if (hoursUntilDeparture < 24) {
    return res.status(400).json({ error: 'Cannot cancel within 24 hours of departure' });
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'cancelled' },
  });

  res.json({ message: 'Booking cancelled' });
});

app.post('/api/bookings/upload-receipt', writeLimiter, uploadReceipt.single('receipt'), validate(uploadReceiptSchema), async (req, res) => {
  const { reference_code, contact_email } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const booking = await prisma.booking.findUnique({ where: { referenceCode: reference_code } });
  if (!booking) {
    deleteUploadedFileOnError(file);
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (booking.contactEmail.toLowerCase() !== contact_email.toLowerCase()) {
    deleteUploadedFileOnError(file);
    return res.status(403).json({ error: 'Reference code and email do not match' });
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { receiptImagePath: `receipts/${file.filename}` },
  });

  res.json({ message: 'Receipt uploaded' });
});

app.post(
  '/api/bookings/passengers/:passengerId/discount-id',
  writeLimiter,
  uploadDiscountId.single('discount_id'),
  validate(passengerIdParamSchema, 'params'),
  validate(uploadDiscountIdSchema),
  async (req, res) => {
    const { reference_code, contact_email } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const passenger = await prisma.bookingPassenger.findUnique({
      where: { id: req.params.passengerId },
      include: { booking: true },
    });

    if (!passenger || passenger.booking.referenceCode !== reference_code) {
      deleteUploadedFileOnError(file);
      return res.status(404).json({ error: 'Passenger not found for this booking' });
    }
    if (passenger.booking.contactEmail.toLowerCase() !== contact_email.toLowerCase()) {
      deleteUploadedFileOnError(file);
      return res.status(403).json({ error: 'Reference code and email do not match' });
    }

    await prisma.bookingPassenger.update({
      where: { id: passenger.id },
      data: { discountIdPath: `discount-ids/${file.filename}` },
    });

    res.json({ message: 'Discount ID uploaded' });
  }
);

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
  const { ferry_id, direction, departure_datetime, base_fare } = req.body;
  const schedule = await prisma.schedule.create({
    data: {
      ferryId: ferry_id,
      direction,
      departureDatetime: new Date(departure_datetime),
      baseFare: base_fare,
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

app.get('/api/admin/bookings/pending', requireAuth, adminLimiter, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { status: 'pending_payment', receiptImagePath: { not: null } },
    include: { passengers: true },
  });
  res.json(bookings);
});

app.post('/api/admin/bookings/:id/approve', requireAuth, adminLimiter, validate(idParamSchema, 'params'), async (req, res) => {
  await prisma.booking.update({
    where: { id: req.params.id },
    data: { status: 'confirmed' },
  });
  res.json({ message: 'Booking approved' });
});

app.post('/api/admin/bookings/:id/decline', requireAuth, adminLimiter, validate(idParamSchema, 'params'), async (req, res) => {
  await prisma.booking.update({
    where: { id: req.params.id },
    data: { status: 'payment_declined' },
  });
  res.json({ message: 'Booking declined' });
});

app.get('/api/admin/bookings', requireAuth, adminLimiter, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    include: { passengers: true, schedule: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings);
});

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

app.get('/api/admin/customers/pending-discounts', requireAuth, adminLimiter, async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { discountStatus: 'pending' },
    select: {
      id: true, firstName: true, lastName: true, email: true, contactNumber: true,
      discountType: true, discountIdPath: true, selfiePath: true, createdAt: true,
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
// Admin-only file access (receipts, discount IDs)
// ---------------------------------------------------------------------------

app.get('/api/admin/uploads/:folder/:filename', requireAuth, (req, res) => {
  const { folder, filename } = req.params;
  if (!['receipts', 'discount-ids', 'selfies'].includes(folder)) {
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