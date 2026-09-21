# Evershine Booking — Study Guide

A ferry booking system for the Padre Burgos ↔ Limasawa route (Southern Leyte, Philippines). Use this to prepare for your professor's walkthrough. It covers what the system is, how it's built, how data flows through it, and questions you're likely to get asked.

---

## 1. The elevator pitch

Evershine Booking lets a passenger search ferry schedules, book seats (with or without an account), pay via GCash/Maya QR, and receive an email invoice usable as boarding proof. Admins manage ferries, schedules, bookings, refunds, and customer discount verification (Senior/PWD/Student) from a separate dashboard.

If your professor asks "what problem does this solve": manual/paper ticketing for a small inter-island ferry route is slow and error-prone — no live schedule visibility, no digital proof of payment, no way to verify discount eligibility except in person. This digitizes that whole flow end to end.

## 2. Tech stack

**Frontend:** React 19 + Vite + React Router v7. Tailwind CSS v4 (note: no `tailwind.config.js` — v4 configures via `@import "tailwindcss"` in CSS directly). Leaflet + react-leaflet for the port-directions map (lazy-loaded since it's heavy). Plain `fetch` wrapped in a small `api.js` module — no Redux/Zustand, state is component-level `useState`/Context.

**Backend:** Node.js + Express 5. PostgreSQL via Prisma ORM (Prisma 7, using the new `@prisma/adapter-pg` driver adapter). JWT for auth (`jsonwebtoken`), `bcrypt` for password hashing, `helmet` for security headers, `express-rate-limit` for throttling, `zod` for request validation, `multer` for file uploads (ID photos), `otplib` for admin 2FA (TOTP), `qrcode` for generating QR images, `resend` for transactional email.

**Payments:** PayMongo (QR Ph — the Philippine unified QR standard that GCash, Maya, and bank apps can all scan).

**Hosting:** Render (both frontend static site and backend web service), custom domain `evershinebooking.com` purchased through Namecheap.

**Docker:** used only for local development — a `docker-compose.yml` at the project root spins up a single `postgres:16` container (with a named volume so data survives restarts) so you don't need PostgreSQL installed natively on your machine. There's no Dockerfile for the frontend or backend, and production on Render does not run this container — it almost certainly uses Render's own managed Postgres instead. If asked "is this containerized in production," the honest answer is no; Docker's role here is strictly a dev-environment convenience.

If asked "why Prisma / why Express / why not X" — reasonable answers: Prisma gives type-safe queries and migrations without hand-written SQL; Express is minimal and well-understood for a REST API of this size; no heavyweight frontend state library was needed because most state is local to a single page/flow (search → booking → payment).

## 3. Two separate apps, one repo

- `frontend/` — the React SPA. Public-facing customer site + `/admin` (admin dashboard is a route in the same SPA, gated by role, not a separate deployment).
- `backend/` — the Express API, deployed separately. Frontend talks to it over `/api/*` (proxied to `localhost:4000` in dev via Vite's `server.proxy`).

They deploy independently on Render. This separation is standard for anything beyond a toy project: the API can be scaled, restarted, or redeployed without touching the static frontend bundle, and the same API could serve a future mobile app.

## 4. Database schema (Prisma models)

| Model | Purpose |
|---|---|
| `Admin` | Staff accounts. Has TOTP secret + `twoFactorEnabled` flag for 2FA. |
| `Customer` | Registered passenger accounts. Stores address (barangay/city/province/zip/region), discount type/status, selfie + ID photo paths, email verification state. |
| `Ferry` | A physical vessel — name + seat capacity. |
| `Schedule` | One sailing: ferry + direction + departure time + base fare + per-schedule discount percentages (senior/PWD/student — set by admin per schedule, not a global constant, so an old schedule keeps whatever rate was active when it was created). |
| `Booking` | One reservation. Status enum: `pending_payment → confirmed`, or `cancelled` / `payment_declined` / `refund_requested` / `refunded`. Has a unique human-readable `referenceCode`. `customerId` is nullable — guest checkout doesn't require an account. |
| `BookingPassenger` | One row per passenger on a booking (name, sex, nationality, address, discount type, computed fare). |
| `Payment` | One-to-one with Booking. Tracks PayMongo's `paymentIntentId`, the QR image URL, amount, status, expiry. |
| `GuestEmailVerification` | Short-lived one-time codes for guest checkout email verification (no account = nothing persistent to mark "verified"). |
| `AdminAuditLog` | Records admin-side security events (logins, etc.) with IP address. |

Key relational point to be ready to explain: **a Booking belongs to a Schedule, and optionally to a Customer.** Guest bookings have `customerId = null`; the contact email/number is stored directly on the Booking instead.

## 5. Core user flows

### A. Search & Book
1. Customer picks a direction (Padre Burgos → Limasawa or reverse) and date on the Search page.
2. Backend returns matching `Schedule` rows for that date/direction (`GET /api/schedules`).
3. Customer picks a sailing → lands on the Booking page with schedule/fare/discount-percent info carried in the URL query string.
4. Fills in passenger details (1–10 passengers). Passenger 1 doubles as the booking contact for guests; logged-in customers can pre-fill Passenger 1 from their account or book for someone else.
5. **Guest checkout requires email verification first** (a 6-digit code sent to Passenger 1's email, verified on a separate page before the booking can be created) — logged-in customers instead just need `emailVerified` on their account.
6. Review step, then `POST /api/bookings` creates the Booking + BookingPassengers, status `pending_payment`.

### B. Payment (PayMongo QR Ph)
1. Once a booking exists, the frontend calls `POST /api/bookings/generate-payment`, which creates a PayMongo payment intent and returns a QR code image.
2. Customer scans with GCash/Maya/banking app, or downloads the QR image to scan from another device.
3. Two ways the booking gets marked paid:
   - **Webhook** (`POST /api/webhooks/paymongo`) — PayMongo calls this server-to-server when payment succeeds. Verified via HMAC-SHA256 signature check using `timingSafeEqual` (prevents timing attacks) before trusting the payload. Registered with `express.raw()` *before* `express.json()` globally, because signature verification needs the exact original bytes — JSON-parsing first would change them and break verification.
   - **Polling fallback** — the frontend polls `GET /api/bookings/payment-status` every 8 seconds while waiting, which also independently checks PayMongo's API and flips the booking to `confirmed` if needed. This covers the case where the webhook is delayed or the customer's browser reloaded (see the mobile bug fix below).
4. On confirmation, `sendBookingInvoice` emails a branded invoice (logo, terminal address/contact, reference code, passenger table, "before you board" reminders) usable as boarding proof.

**Known edge case you fixed:** on mobile, switching to the GCash app to pay can cause the browser tab to be discarded and reloaded when the customer returns, wiping all in-memory React state (`booking`, `paymentStatus`, the QR image) even though payment succeeded server-side. Fix: the booking reference + contact email are saved to `localStorage` right after booking creation; on mount, if a saved entry exists, the app re-fetches the real booking state from the server (`GET /api/bookings/lookup`) and resumes at the correct step instead of restarting the flow.

### C. Manage / Cancel a Booking
- `GET /api/bookings/lookup` — look up by reference code + contact email (no login needed; the email match acts as a lightweight authorization check since only the person who booked would know both values).
- Cancellation is only allowed within 24 hours of the *booking being made* (not departure time) — `POST /api/bookings/cancel` sets status to `refund_requested`, which an admin later marks `refunded` after manually verifying and sending the refund. There's no automated payout integration.

### D. Admin Dashboard
- Separate login with **mandatory 2FA** (TOTP, e.g., Google Authenticator) — `requireAdminOrSetup` allows a short-lived token to reach the 2FA setup screen before a full session exists, `requireAuth` is the full gate afterward.
- Manages Ferries & Schedules (including deleting a schedule — blocked server-side if it already has bookings, to avoid orphaning booking records), Customers, Profile Verification (approve/reject discount ID submissions), All Bookings, Refund Requests, Manifest (printable passenger list per sailing), Analytics (monthly sales).

### E. Discount / Profile Verification
- A customer submits: a live camera selfie (not a gallery upload — proves it's really them, taken at submission time) + front and back photos of a valid ID + which discount type (Senior/PWD/Student) they're claiming.
- Status flow: `none → pending → verified` (or `rejected`). An admin manually reviews and approves/rejects.
- `discountVerifiedUntil` — verification expires, so it's periodically re-checked, not permanent.
- Only a `verified` status unlocks the discount percentage on that customer's bookings — enforced **server-side** at booking-creation time (the client-side discount dropdown is just UI; the server recalculates the real fare from the schedule's discount percentage and the customer's actual verified status, so a tampered client request can't grant a discount it isn't entitled to).

## 6. Security — likely exam topics

- **Password hashing:** `bcrypt`, never plaintext.
- **JWT auth**, two separate roles/tokens: `admin` and `customer`, each checked via its own middleware (`requireAuth` vs `requireCustomerAuth`) so a customer token can't be used to hit admin routes and vice versa.
- **Admin 2FA is mandatory** (TOTP), not optional — meaningfully harder to compromise than password-only.
- **Rate limiting** on nearly everything, tuned per endpoint: login attempts capped at 5 per 15 minutes (both by IP and by the specific email being attacked, so someone can't just rotate IPs to brute-force one account), general writes at 20/15min, admin actions at 50/15min keyed per-admin, guest verification codes and contact-form submissions at 5/15min (both are ways to spam an inbox, so they're capped tightly).
- **Input validation** via `zod` schemas on every route (`validate(schema)` middleware) — rejects malformed input before it reaches business logic.
- **`helmet`** sets standard security headers (prevents clickjacking, disables MIME sniffing, etc.).
- **Webhook signature verification** — HMAC-SHA256 with `crypto.timingSafeEqual`, so an attacker can't fake a "payment succeeded" webhook to get a free booking.
- **CORS** locked to a specific `FRONTEND_URL` origin, not wildcard `*`.
- **Discounts are recalculated server-side**, never trusted from the client (see section 5E).
- **Guest checkout is still authenticated via email possession** — you can't book under someone else's identity as a guest without controlling their inbox, because a one-time code has to be verified first.
- If asked "what would you improve": rotating/short-lived refresh tokens (current JWTs last 1 day for admins and 7 days for customers, with no refresh/revocation flow), a proper admin permissions/roles system if the team grows, automated PayMongo refund payouts instead of manual admin confirmation.

## 7. Design decisions worth being able to defend

- **Guest checkout exists at all** — because forcing account creation before every booking is friction that loses customers; verification is done per-booking-attempt via a disposable one-time code instead.
- **Discount percentages live on the Schedule, not a global config** — so a rate change doesn't retroactively alter historical schedules/bookings.
- **Separate `BookingPassenger` rows instead of a JSON blob** — keeps passenger data queryable/relational (e.g., for the admin Manifest and reports), and each passenger can have their own discount type and computed fare.
- **Cancellation window is 24 hours from booking time, not departure time** — a deliberate policy choice, not a bug; it means a last-minute booking can still be cancelled shortly after purchase.
- **Directions/map page is lazy-loaded** (`React.lazy` + `Suspense`) — Leaflet is one of the heaviest dependencies, and most visits never open the map, so it's kept out of everyone's initial bundle.
- **Flat, solid-color UI with no gradients/glows/translucent borders** — a deliberate visual style choice made throughout the frontend for a clean, professional, "official government/transport service" feel rather than a trendy consumer-app look.

## 8. If your professor asks you to walk through code live

Good files to have open and be ready to narrate:
- `backend/prisma/schema.prisma` — the whole data model in one file.
- `backend/index.js` — search for the route in question (all routes are `app.get/post/patch/delete('/api/...')`).
- `frontend/src/pages/Booking.jsx` — the most complex page; the whole book → pay → confirm flow lives here.
- `backend/lib/paymongo.js` — payment intent creation/QR generation logic.
- `backend/lib/email.js` — the invoice/verification email templates.
- `frontend/src/api.js` — one place listing every frontend→backend call, useful as a map of "what can the frontend do."

## 9. Quick-reference: full route list

**Public / customer:** `POST /login`, `POST /login/2fa`, `POST /register`, `GET /verify-email`, `POST /customer/login`, `GET /customer/me`, `GET /customer/me/photo`, `PATCH /customer/me`, `POST /customer/resend-verification`, `GET /customer/bookings`, `POST /customer/discount-request`, `GET /ferries`, `GET /schedules`, `POST /guest/send-code`, `POST /guest/verify-code`, `POST /contact`, `POST /bookings`, `GET /bookings/lookup`, `POST /bookings/cancel`, `POST /bookings/generate-payment`, `GET /bookings/payment-status`, `POST /webhooks/paymongo`.

**Admin only (`requireAuth`):** 2FA setup/enable/disable, logout, `GET /admin/me`, ferries/schedules CRUD (+ delete schedule), `GET /admin/bookings`, refund requests (list/mark-refunded/reject), manifest per schedule, monthly sales analytics, customers list, pending discount requests (verify/reject), protected file uploads (ID photos/selfies).

---

**Before tomorrow:** re-read section 5 (the flows) twice — that's what a professor usually probes hardest, since it proves you understand the *system* and not just isolated files. Section 6 (security) is the second most likely deep-dive.
