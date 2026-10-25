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

  getUpcomingScheduleDates: (direction) =>
    request(`/schedules/upcoming-dates?direction=${direction}`),


  createBooking: (payload) =>
    request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...customerAuthHeaders() },
      body: JSON.stringify(payload),
    }),


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


  downloadInvoicePdf: async (referenceCode, contactEmail) => {
    const response = await fetch(
      `${BASE}/bookings/invoice-pdf?reference_code=${encodeURIComponent(referenceCode)}&contact_email=${encodeURIComponent(contactEmail)}`
    )
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Could not download the invoice.')
    }
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `evershine-invoice-${referenceCode}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  },

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

  editSchedule: (id, payload) =>
    adminRequest(`/admin/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  deleteSchedule: (id) => adminRequest(`/admin/schedules/${id}`, { method: 'DELETE' }),

  getAllBookings: () => adminRequest('/admin/bookings'),

  adminCancelBooking: (id) => adminRequest(`/admin/bookings/${id}/cancel`, { method: 'POST' }),

  getRefundRequests: () => adminRequest('/admin/refund-requests'),

  markRefunded: (id) => adminRequest(`/admin/refund-requests/${id}/mark-refunded`, { method: 'POST' }),

  rejectRefundRequest: (id) => adminRequest(`/admin/refund-requests/${id}/reject`, { method: 'POST' }),

  getManifest: (scheduleId) => adminRequest(`/admin/schedules/${scheduleId}/manifest`),


  sendManifest: (scheduleId, payload) =>
    adminRequest(`/admin/schedules/${scheduleId}/manifest/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getMonthlySales: () => adminRequest('/admin/analytics/monthly-sales'),

 
  getAccounting: (from, to) => adminRequest(`/admin/accounting?from=${from}&to=${to}`),

  getWeather: () => adminRequest('/admin/weather'),

  getPagasaBulletin: () => adminRequest('/admin/pagasa-bulletin'),


  createCoastGuardAccount: (payload) =>
    adminRequest('/admin/coastguard-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getCoastGuardAccounts: () => adminRequest('/admin/coastguard-accounts'),

  getCoastGuardMe: () => adminRequest('/admin/coastguard/me'),

  getCoastGuardMessages: (before) =>
    adminRequest(`/admin/coastguard/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`),

  
  sendCoastGuardMessageRest: (body) =>
    adminRequest('/admin/coastguard/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }),

  markCoastGuardChatRead: () => adminRequest('/admin/coastguard/mark-read', { method: 'POST' }),


  getCoastGuardManifests: () => adminRequest('/admin/coastguard/manifests'),

 
  downloadCoastGuardManifestPdf: async (id, filenameHint) => {
    const response = await fetch(`${BASE}/admin/coastguard/manifests/${id}/pdf`, { headers: authHeaders() })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Could not download the manifest.')
    }
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filenameHint || 'evershine-manifest.pdf'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  },


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