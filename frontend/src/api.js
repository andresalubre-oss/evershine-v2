const BASE = import.meta.env.VITE_API_URL || '/api'

function authHeaders() {
  const token = localStorage.getItem('adminToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function customerAuthHeaders() {
  const token = localStorage.getItem('customerToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const err = new Error(data.error || 'Something went wrong.')
    // Some errors (e.g. booking blocked by an unverified email) carry a
    // machine-readable `code` so a page can react specifically — like
    // showing a "Resend verification email" button — instead of just
    // displaying the message text.
    err.code = data.code
    throw err
  }
  return data
}

async function adminRequest(path, options = {}) {
  return request(path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  })
}

async function customerRequest(path, options = {}) {
  return request(path, {
    ...options,
    headers: { ...customerAuthHeaders(), ...(options.headers || {}) },
  })
}

export const api = {
  login: (email, password) =>
    request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  // Second step of admin login when the account has 2FA enabled — exchanges
  // the short-lived pendingToken from /login plus a 6-digit TOTP code for a
  // real session token.
  verifyLogin2fa: (pendingToken, code) =>
    request('/login/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pending_token: pendingToken, code }),
    }),

  getAdminMe: () => adminRequest('/admin/me'),

  setup2fa: (token) =>
    adminRequest('/admin/2fa/setup', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  enable2fa: (code, token) =>
    adminRequest('/admin/2fa/enable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code }),
    }),

  disable2fa: (password) =>
    adminRequest('/admin/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),

    
  adminLogout: () => adminRequest('/admin/logout', { method: 'POST' }),

  getFerries: () => request('/ferries'),

  getSchedules: (direction, date) =>
    request(`/schedules?direction=${direction}&date=${date}`),

  // Attaches the customer's token if they're logged in (so the backend can
  // check whether their profile is discount-verified), but works fine
  // without one too — guests can still book, as long as `payload` includes
  // a valid guest_verification_token from verifyGuestCode below.
  createBooking: (payload) =>
    request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...customerAuthHeaders() },
      body: JSON.stringify(payload),
    }),

  // Guest checkout's email verification — no account, so this is a live,
  // one-time code rather than a background flag like customers get.
  sendGuestCode: (email) =>
    request('/guest/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),

  verifyGuestCode: (email, code) =>
    request('/guest/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    }),

  // Contact Us page — delivered server-side via Resend, so submitting stays
  // on the page instead of kicking the visitor out to their email app.
  sendContactMessage: (name, email, message) =>
    request('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message }),
    }),

  register: (payload) =>
    request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  customerLogin: (email, password) =>
    request('/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  getCustomerMe: () => customerRequest('/customer/me'),

  updateProfile: (payload) =>
    customerRequest('/customer/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getMyBookings: () => customerRequest('/customer/bookings'),

  verifyEmail: (token) => request(`/verify-email?token=${encodeURIComponent(token)}`),

  resendVerification: () => customerRequest('/customer/resend-verification', { method: 'POST' }),

  // The live selfie captured during Profile Verification doubles as the
  // account's permanent profile photo. Returns null (not a thrown error)
  // when the customer hasn't submitted one yet, so callers can fall back
  // to an initials avatar without treating "no photo" as a failure.
  getMyPhotoUrl: async () => {
    const response = await fetch(`${BASE}/customer/me/photo`, {
      headers: customerAuthHeaders(),
    })
    if (!response.ok) return null
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  },

  requestDiscount: (formData) =>
    customerRequest('/customer/discount-request', { method: 'POST', body: formData }),

  getAllCustomers: () => adminRequest('/admin/customers'),

  getPendingDiscounts: () => adminRequest('/admin/customers/pending-discounts'),

  verifyDiscount: (id, expiresAt) =>
    adminRequest(`/admin/customers/${id}/verify-discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_at: expiresAt }),
    }),

  rejectDiscount: (id) => adminRequest(`/admin/customers/${id}/reject-discount`, { method: 'POST' }),

  generatePayment: (referenceCode, contactEmail) =>
    request('/bookings/generate-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference_code: referenceCode, contact_email: contactEmail }),
    }),

  getPaymentStatus: (referenceCode, contactEmail) =>
    request(
      `/bookings/payment-status?reference_code=${encodeURIComponent(referenceCode)}&contact_email=${encodeURIComponent(contactEmail)}`
    ),

  lookupBooking: (referenceCode, contactEmail) =>
    request(`/bookings/lookup?reference_code=${encodeURIComponent(referenceCode)}&contact_email=${encodeURIComponent(contactEmail)}`),

  cancelBooking: (referenceCode, contactEmail, reason) =>
    request('/bookings/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference_code: referenceCode, contact_email: contactEmail, reason }),
    }),

  addFerry: (payload) =>
    adminRequest('/admin/ferries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  addSchedule: (payload) =>
    adminRequest('/admin/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getAdminSchedules: () => adminRequest('/admin/schedules'),

  deleteSchedule: (id) => adminRequest(`/admin/schedules/${id}`, { method: 'DELETE' }),

  getAllBookings: () => adminRequest('/admin/bookings'),

  getRefundRequests: () => adminRequest('/admin/refund-requests'),

  markRefunded: (id) => adminRequest(`/admin/refund-requests/${id}/mark-refunded`, { method: 'POST' }),

  rejectRefundRequest: (id) => adminRequest(`/admin/refund-requests/${id}/reject`, { method: 'POST' }),

  getManifest: (scheduleId) => adminRequest(`/admin/schedules/${scheduleId}/manifest`),

  getMonthlySales: () => adminRequest('/admin/analytics/monthly-sales'),

  // Verification selfies/ID photos are behind an authenticated route (not a
  // public static folder), so a plain <img src> can't load them directly —
  // fetch as a blob and hand back an object URL instead.
  getAdminFileUrl: async (relativePath) => {
    const response = await fetch(`${BASE}/admin/uploads/${relativePath}`, {
      headers: authHeaders(),
    })
    if (!response.ok) {
      throw new Error('Failed to load file')
    }
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  },
}