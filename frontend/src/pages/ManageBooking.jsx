// Save as: frontend/src/pages/ManageBooking.jsx

import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
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
    <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// Only alert triangle survives in the redesigned Booking Details view — the
// rest of that page now uses plain solid-color left-border cards instead of
// icon badges. This one is still used by the lookup form's error message.
function IconAlertTriangle(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 3.9L1.9 18a1.5 1.5 0 001.3 2.3h17.6a1.5 1.5 0 001.3-2.3L13.7 3.9a1.5 1.5 0 00-2.6 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 16.5v.01" />
    </svg>
  )
}

function IconChevron(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  )
}

// Promo/ad slider shown in the sidebar. Drop full poster-style images
// (whatever you design — payment methods, promos, etc.) into
// frontend/public/ and reference them here; nothing else needs to change.
// object-contain (not cover) is used so a designed poster's text/logos
// never get cropped, regardless of its exact proportions.
const AD_SLIDES = ['/ad-poster-1.png', '/ad-poster-2.png']
const AD_SLIDE_INTERVAL_MS = 7000

function AdSlider() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % AD_SLIDES.length)
    }, AD_SLIDE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  if (AD_SLIDES.length === 0) return null

  function prev() {
    setIndex((i) => (i - 1 + AD_SLIDES.length) % AD_SLIDES.length)
  }
  function next() {
    setIndex((i) => (i + 1) % AD_SLIDES.length)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="relative aspect-[4/5] w-full bg-teal-950">
        {AD_SLIDES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Promotion ${i + 1}`}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}

        {AD_SLIDES.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous promotion"
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100"
            >
              <IconChevron className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next promotion"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100"
            >
              <IconChevron className="h-4 w-4 rotate-180" />
            </button>
          </>
        )}
      </div>

      {AD_SLIDES.length > 1 && (
        <div className="flex justify-center gap-2 border-t border-gray-100 py-2.5">
          {AD_SLIDES.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show promotion ${i + 1} of ${AD_SLIDES.length}`}
              className={`h-2 w-2 rounded-full transition-colors ${i === index ? 'bg-teal-700' : 'bg-gray-300'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ManageBooking() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [referenceCode, setReferenceCode] = useState(searchParams.get('reference_code') || '')
  const [contactEmail, setContactEmail] = useState(searchParams.get('contact_email') || '')
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

  // Lets a link elsewhere in the app (e.g. a booking card on the Account
  // dashboard) deep-link straight to that booking's details, instead of
  // landing on the blank lookup form and making the customer re-type
  // information the app already has.
  useEffect(() => {
    if (searchParams.get('reference_code') && searchParams.get('contact_email')) {
      lookupBooking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function lookupAnotherBooking() {
    setBooking(null)
    setReferenceCode('')
    setContactEmail('')
    setError('')
    setCancelMessage('')
    navigate('/manage-booking')
  }

  // Once a booking is loaded, this page shows only the booking's details —
  // not the lookup form and info cards crammed above it. Those belong to a
  // different task (finding a booking) than this one (reading it).
  if (booking) {
    return (
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={lookupAnotherBooking}
          className="text-base font-medium text-teal-700 hover:text-teal-800 hover:underline"
        >
          &larr; Look up a different booking
        </button>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-5">
          <div>
            <p className="text-base font-medium text-gray-500">Booking Details</p>
            <h1 className="mt-0.5 font-mono text-3xl font-bold tracking-wide text-gray-800 sm:text-4xl">
              {booking.referenceCode}
            </h1>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Three focused cards instead of one long stacked card — each has
            its own solid-color left-border accent (same pattern used on the
            Account dashboard) so the sections read as distinct information,
            not one wall of content. No icons, no gradients, no shadows. */}
        <div className="mt-6 space-y-5">
          <div className="rounded-xl border border-l-4 border-gray-200 border-l-teal-700 bg-white p-6">
            <h2 className="border-b-2 border-gray-100 pb-3 text-base font-semibold uppercase tracking-wide text-gray-500">
              Trip Details
            </h2>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-base font-medium text-gray-500">Departure</p>
              <p className="text-base font-semibold text-gray-800">
                {departureTime.toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
              <p className="text-base font-medium text-gray-500">Total Fare</p>
              <p className="text-xl font-bold text-teal-700">{formatPeso(booking.totalFare)}</p>
            </div>

            <Link
              to={`/directions?direction=${booking.schedule.direction}`}
              className="mt-4 inline-block rounded-md border border-teal-700 px-5 py-2.5 text-base font-medium text-teal-700 hover:bg-teal-50"
            >
              Get Directions to the Port
            </Link>
          </div>

          <div className="rounded-xl border border-l-4 border-gray-200 border-l-blue-600 bg-white p-6">
            <h2 className="border-b-2 border-gray-100 pb-3 text-base font-semibold uppercase tracking-wide text-gray-500">
              Passengers
            </h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full min-w-[420px] text-base">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-sm font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Passenger</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3 text-right">Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.passengers.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-800">{fullName(p)}</td>
                      <td className="px-4 py-3 capitalize text-gray-600">
                        {p.discountType === 'none' ? '—' : p.discountType}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800">{formatPeso(p.fare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-l-4 border-gray-200 border-l-amber-600 bg-white p-6">
            <h2 className="border-b-2 border-gray-100 pb-3 text-base font-semibold uppercase tracking-wide text-gray-500">
              Cancellation
            </h2>

            <div className="mt-4">
              {booking.status === 'cancelled' && (
                <div className="rounded-lg border border-l-4 border-gray-200 border-l-gray-400 bg-gray-50 p-4 text-base text-gray-600">
                  This booking has been cancelled.
                </div>
              )}

              {booking.status === 'refund_requested' && (
                <div className="rounded-lg border border-l-4 border-blue-100 border-l-blue-600 bg-blue-50 p-4 text-base text-blue-800">
                  Your cancellation request has been submitted and is awaiting review. Our team verifies each
                  request manually and sends the refund once approved — this isn't instant.
                </div>
              )}

              {booking.status === 'refunded' && (
                <div className="rounded-lg border border-l-4 border-blue-100 border-l-blue-600 bg-blue-50 p-4 text-base text-blue-800">
                  This booking was cancelled and your refund has been sent.
                </div>
              )}

              {!alreadyResolved && canCancel && !confirmingCancel && (
                <>
                  <div className="rounded-lg border border-l-4 border-teal-100 border-l-teal-700 bg-teal-50 p-4 text-base text-teal-800">
                    You're within the 24-hour cancellation window — <b>{hoursLeft}h {minutesLeft}m</b> left to
                    request a cancellation.
                  </div>
                  <button
                    onClick={() => setConfirmingCancel(true)}
                    className="mt-3 rounded-md border border-red-200 px-5 py-2.5 text-base font-medium text-red-600 hover:bg-red-50"
                  >
                    Cancel This Booking
                  </button>
                </>
              )}

              {!alreadyResolved && canCancel && confirmingCancel && (
                <div className="rounded-lg border border-l-4 border-red-100 border-l-red-600 bg-red-50 p-4">
                  <p className="text-base font-semibold text-red-800">Request a cancellation?</p>
                  <p className="mt-1 text-base text-red-700">
                    This submits a cancellation request for manual review it isn't instant. Our team will verify
                    your reason and sends the refund once approved.
                  </p>

                  <label className="mt-3 block text-sm font-medium uppercase tracking-wide text-red-800">
                    Reason for cancellation
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Change of plans, booked the wrong date, medical emergency..."
                    className="mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-base text-gray-800 placeholder:text-gray-400"
                  />

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={confirmCancelBooking}
                      disabled={cancelling || !cancelReason.trim()}
                      className="flex items-center gap-2 rounded-md bg-red-600 px-5 py-2.5 text-base font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="rounded-md border border-gray-300 px-5 py-2.5 text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      No, Keep Booking
                    </button>
                  </div>
                </div>
              )}

              {!alreadyResolved && !canCancel && (
                <div className="rounded-lg border border-l-4 border-amber-100 border-l-amber-600 bg-amber-50 p-4 text-base text-amber-800">
                  This booking can no longer be cancelled cancellations must be requested within 24 hours of
                  booking, and that window has passed. See our{' '}
                  <Link to="/refund-cancellation" className="font-medium underline">
                    Refund &amp; Cancellation
                  </Link>{' '}
                  page for details.
                </div>
              )}

              {cancelMessage && (
                <p className={`mt-3 text-base font-medium ${cancelError ? 'text-red-600' : 'text-teal-700'}`}>
                  {cancelMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-3xl font-bold text-gray-800 sm:text-4xl">Manage Your Booking</h1>
        <p className="mt-1.5 text-base text-gray-600">
          Look up a booking to view its details, get directions to the terminal, or request a cancellation.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form
          onSubmit={lookupBooking}
          className="h-fit rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7"
        >
          <h2 className="text-lg font-semibold text-gray-800">Find your booking</h2>
          <p className="mt-1 text-base text-gray-500">Both fields must match exactly what was used at checkout.</p>

          <label className="mt-5 block text-base font-medium text-gray-700">Reference Code</label>
          <input
            type="text"
            placeholder="e.g. EBJBCBTA"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
          <p className="mt-1.5 text-sm text-gray-400">
            The 8-character code from your booking confirmation email. Not case-sensitive.
          </p>

          <label className="mt-4 block text-base font-medium text-gray-700">Email used when booking</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          />

          <button
            type="submit"
            disabled={looking}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-6 py-3 text-base font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
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
            <p className="mt-3 flex items-start gap-1.5 text-base text-red-600">
              <IconAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </p>
          )}
        </form>

        {/* Supporting info alongside the form — this page used to be just a
            bare card with no other context, so first-time visitors had no
            way to tell where the reference code comes from, what this page
            can actually do, or how to get help if lookup fails. */}
        <aside className="space-y-4">
          <AdSlider />
        </aside>
      </div>
    </div>
  )
}
