const BASE = '/api'

function authHeaders() {
  const token = localStorage.getItem('adminToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong.')
  }
  return data
}

async function adminRequest(path, options = {}) {
  return request(path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  })
}

export const api = {
  login: (email, password) =>
    request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  getFerries: () => request('/ferries'),

  getSchedules: (direction, date) =>
    request(`/schedules?direction=${direction}&date=${date}`),

  createBooking: (payload) =>
    request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  uploadReceipt: (formData) =>
    request('/bookings/upload-receipt', { method: 'POST', body: formData }),

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

  uploadDiscountId: (passengerId, formData) =>
    request(`/bookings/passengers/${passengerId}/discount-id`, { method: 'POST', body: formData }),

  lookupBooking: (referenceCode, contactEmail) =>
    request(`/bookings/lookup?reference_code=${encodeURIComponent(referenceCode)}&contact_email=${encodeURIComponent(contactEmail)}`),

  cancelBooking: (referenceCode, contactEmail) =>
    request('/bookings/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference_code: referenceCode, contact_email: contactEmail }),
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

  getPendingBookings: () => adminRequest('/admin/bookings/pending'),

  approveBooking: (id) => adminRequest(`/admin/bookings/${id}/approve`, { method: 'POST' }),

  declineBooking: (id) => adminRequest(`/admin/bookings/${id}/decline`, { method: 'POST' }),

  getAllBookings: () => adminRequest('/admin/bookings'),

  getManifest: (scheduleId) => adminRequest(`/admin/schedules/${scheduleId}/manifest`),

  getMonthlySales: () => adminRequest('/admin/analytics/monthly-sales'),

  // Receipts/discount IDs are behind an authenticated route (not a public
  // static folder), so a plain <img src> can't load them directly — fetch
  // as a blob and hand back an object URL instead.
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