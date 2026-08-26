// Save as: frontend/src/pages/ManageBooking.jsx

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

function fullName(p) {
  return [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ')
}

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// Same status palette used on the account dashboard's booking history, so a
// booking reads the same way whether you're looking it up as a guest here
// or logged in and viewing "My Bookings".
const statusColors = {
  confirmed: 'bg-green-100 text-green-800',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-gray-100 text-gray-700',
  payment_declined: 'bg-red-100 text-red-800',
  refund_requested: 'bg-blue-100 text-blue-800',
  refunded: 'bg-blue-100 text-blue-800',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function IconTicket(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z" />
      <path strokeLinecap="round" d="M14 6v12" strokeDasharray="2 3" />
    </svg>
  )
}
function IconCalendar(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function IconAlertTriangle(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 3.9L1.9 18a1.5 1.5 0 001.3 2.3h17.6a1.5 1.5 0 001.3-2.3L13.7 3.9a1.5 1.5 0 00-2.6 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 16.5v.01" />
    </svg>
  )
}
function IconCheckCircle(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5l2.5 2.5 5-5" />
    </svg>
  )
}

export default function ManageBooking() {
  const [referenceCode, setReferenceCode] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')
  const [looking, setLooking] = useState(false)

  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelMessage, setCancelMessage] = useState('')
  const [cancelError, setCancelError] = useState(false)

  async function lookupBooking(e) {
    e?.preventDefault()
    if (!referenceCode.trim() || !contactEmail.trim()) {
      setError('Please enter both your reference code and email.')
      return
    }
    setError('')
    setCancelMessage('')
    setConfirmingCancel(false)
    setLooking(true)
    try {
      const data = await api.lookupBooking(referenceCode.trim().toUpperCase(), contactEmail.trim())
      setBooking(data)
    } catch (err) {
      setBooking(null)
      setError(err.message)
    } finally {
      setLooking(false)
    }
  }

  async function confirmCancelBooking() {
    setCancelMessage('')
    setCancelError(false)
    if (!cancelReason.trim()) {
      setCancelMessage('Please tell us why you want to cancel.')
      setCancelError(true)
      return
    }
    setCancelling(true)
    try {
      const data = await api.cancelBooking(booking.referenceCode, booking.contactEmail, cancelReason.trim())
      setConfirmingCancel(false)
      setCancelReason('')
      await lookupBooking()
      setCancelMessage(data.message || 'Your cancellation request has been submitted.')
    } catch (err) {
      setCancelMessage(err.message)
      setCancelError(true)
    } finally {
      setCancelling(false)
    }
  }

  const departureTime = booking ? new Date(booking.schedule.departureDatetime) : null
  const purchasedAt = booking ? new Date(booking.createdAt) : null
  // Cancellation eligibility is a 24-hour window from PURCHASE, not how far
  // away departure is — a short-notice booking is still cancellable right
  // after it's made, but an old booking can't be cancelled just because
  // departure happens to still be far off.
  const hoursSincePurchase = purchasedAt ? (new Date() - purchasedAt) / (1000 * 60 * 60) : 0
  const alreadyResolved = booking && ['cancelled', 'refund_requested', 'refunded'].includes(booking.status)
  const canCancel = booking && !alreadyResolved && hoursSincePurchase <= 24
  const hoursLeftInWindow = Math.max(0, 24 - hoursSincePurchase)
  const hoursLeft = Math.floor(hoursLeftInWindow)
  const minutesLeft = Math.max(0, Math.round((hoursLeftInWindow - hoursLeft) * 60))

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-gray-800">Manage Your Booking</h1>
      <p className="mt-1 text-gray-600">Enter your reference code and email to view or cancel your booking.</p>

      <form
        onSubmit={lookupBooking}
        className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium text-gray-700">Reference Code</label>
        <input
          type="text"
          placeholder="e.g. EBJBCBTA"
          value={referenceCode}
          onChange={(e) => setReferenceCode(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal"
        />
        <label className="mt-3 block text-sm font-medium text-gray-700">Email used when booking</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5"
        />
        <button
          type="submit"
          disabled={looking}
          className="mt-4 flex items-center justify-center gap-2 rounded-md bg-teal-700 px-5 py-2.5 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {looking && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {looking ? 'Looking up...' : 'Find My Booking'}
        </button>
        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600">
            <IconAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error}
          </p>
        )}
      </form>

      {booking && (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Summary header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <IconTicket className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Reference Code</p>
                <p className="font-mono text-base font-bold tracking-wide text-gray-800">{booking.referenceCode}</p>
              </div>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <div className="p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <IconCalendar className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Departure</p>
                <p className="text-sm font-semibold text-gray-800">
                  {departureTime.toLocaleString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-600">Total Fare</p>
              <p className="text-lg font-bold text-teal-700">{formatPeso(booking.totalFare)}</p>
            </div>

            <Link
              to={`/directions?direction=${booking.schedule.direction}`}
              className="mt-4 inline-block rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              Get Directions to the Port
            </Link>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Passengers</h3>
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Passenger</th>
                    <th className="px-3 py-2">Discount</th>
                    <th className="px-3 py-2 text-right">Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.passengers.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{fullName(p)}</td>
                      <td className="px-3 py-2.5 capitalize text-gray-600">
                        {p.discountType === 'none' ? '—' : p.discountType}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-800">{formatPeso(p.fare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cancellation section */}
            <div className="mt-6 border-t border-gray-100 pt-5">
              {booking.status === 'cancelled' && (
                <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3.5 text-sm text-gray-600">
                  <IconCheckCircle className="h-5 w-5 flex-shrink-0 text-gray-400" />
                  This booking has been cancelled.
                </div>
              )}

              {booking.status === 'refund_requested' && (
                <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-800">
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    Your cancellation request has been submitted and is awaiting review. Our team verifies each
                    request manually and sends the refund once approved — this isn't instant.
                  </span>
                </div>
              )}

              {booking.status === 'refunded' && (
                <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-800">
                  <IconCheckCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
                  This booking was cancelled and your refund has been sent.
                </div>
              )}

              {!alreadyResolved && canCancel && !confirmingCancel && (
                <>
                  <div className="flex items-center gap-2.5 rounded-lg border border-teal-100 bg-teal-50 p-3.5 text-sm text-teal-800">
                    <IconCheckCircle className="h-5 w-5 flex-shrink-0 text-teal-600" />
                    <span>
                      You're within the 24-hour cancellation window — <b>{hoursLeft}h {minutesLeft}m</b> left to
                      request a cancellation.
                    </span>
                  </div>
                  <button
                    onClick={() => setConfirmingCancel(true)}
                    className="mt-3 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Cancel This Booking
                  </button>
                </>
              )}

              {!alreadyResolved && canCancel && confirmingCancel && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="flex items-start gap-2 text-sm font-semibold text-red-800">
                    <IconAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    Request a cancellation?
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    This submits a cancellation request for manual review — it isn't instant. An admin verifies
                    your reason and sends the refund themselves once approved.
                  </p>

                  <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-red-800">
                    Reason for cancellation
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Change of plans, booked the wrong date, medical emergency..."
                    className="mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400"
                  />

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={confirmCancelBooking}
                      disabled={cancelling || !cancelReason.trim()}
                      className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancelling && (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      )}
                      {cancelling ? 'Submitting...' : 'Submit Cancellation Request'}
                    </button>
                    <button
                      onClick={() => { setConfirmingCancel(false); setCancelReason('') }}
                      disabled={cancelling}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      No, Keep Booking
                    </button>
                  </div>
                </div>
              )}

              {!alreadyResolved && !canCancel && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    This booking can no longer be cancelled — cancellations must be requested within 24 hours of
                    booking, and that window has passed. See our{' '}
                    <Link to="/refund-cancellation" className="font-medium underline">
                      Refund &amp; Cancellation
                    </Link>{' '}
                    page for details.
                  </span>
                </div>
              )}

              {cancelMessage && (
                <p className={`mt-3 flex items-start gap-1.5 text-sm ${cancelError ? 'text-red-600' : 'text-teal-700'}`}>
                  {cancelError ? (
                    <IconAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  ) : (
                    <IconCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  )}
                  {cancelMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
