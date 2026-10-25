import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

function fullName(p) {
  return [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ')
}

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}


const statusColors = {
  confirmed: 'bg-green-100 text-green-800',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-gray-100 text-gray-700',
  payment_declined: 'bg-red-100 text-red-800',
  refund_requested: 'bg-blue-100 text-blue-800',
  refunded: 'bg-blue-100 text-blue-800',
}

const CANCEL_REASON_OPTIONS = [
  { value: '', label: 'Select a reason' },
  { value: 'Change of Plans', label: 'Change of Plans' },
  { value: 'Booked the Wrong Date or Trip', label: 'Booked the Wrong Date or Trip' },
  { value: 'Medical Emergency', label: 'Medical Emergency' },
  { value: 'Duplicate Booking', label: 'Duplicate Booking' },
  { value: 'Weather or Safety Concern', label: 'Weather or Safety Concern' },
  { value: 'Other', label: 'Other (please specify)' },
]

function StatusBadge({ status }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
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

function IconChevron(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  )
}

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
  const [cancelReasonCategory, setCancelReasonCategory] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelConsent, setCancelConsent] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelMessage, setCancelMessage] = useState('')
  const [cancelError, setCancelError] = useState(false)

  const [downloadingInvoice, setDownloadingInvoice] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  async function handleDownloadInvoice() {
    setDownloadError('')
    setDownloadingInvoice(true)
    try {
      await api.downloadInvoicePdf(booking.referenceCode, booking.contactEmail)
    } catch (err) {
      setDownloadError(err.message)
    } finally {
      setDownloadingInvoice(false)
    }
  }

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


  useEffect(() => {
    if (searchParams.get('reference_code') && searchParams.get('contact_email')) {
      lookupBooking()
    }
    
  }, [])

  async function confirmCancelBooking() {
    setCancelMessage('')
    setCancelError(false)
    if (!cancelReasonCategory) {
      setCancelMessage('Please select a reason for cancelling.')
      setCancelError(true)
      return
    }
    if (cancelReasonCategory === 'Other' && !cancelReason.trim()) {
      setCancelMessage('Please tell us why you want to cancel.')
      setCancelError(true)
      return
    }
    if (!cancelConsent) {
      setCancelMessage('Please confirm you understand this cancellation is subject to our Refund & Cancellation policy.')
      setCancelError(true)
      return
    }
 
    const combinedReason = cancelReasonCategory === 'Other'
      ? cancelReason.trim()
      : cancelReason.trim()
        ? `${cancelReasonCategory}: ${cancelReason.trim()}`
        : cancelReasonCategory

    setCancelling(true)
    try {
      const data = await api.cancelBooking(booking.referenceCode, booking.contactEmail, combinedReason)
      setConfirmingCancel(false)
      setCancelReasonCategory('')
      setCancelReason('')
      setCancelConsent(false)
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
  const hoursUntilDeparture = departureTime ? (departureTime - new Date()) / (1000 * 60 * 60) : 0
  const alreadyResolved = booking && ['cancelled', 'refund_requested', 'refunded'].includes(booking.status)
  const canCancel = booking && !alreadyResolved && hoursUntilDeparture > 0
  const previewRefundPercent = hoursUntilDeparture > 24 ? 80 : 60
  const hoursLeftInWindow = Math.max(0, hoursUntilDeparture - 24)
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

 
        <div className="mt-6 space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
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

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to={`/directions?direction=${booking.schedule.direction}`}
                className="inline-block rounded-md border border-teal-700 px-5 py-2.5 text-base font-medium text-teal-700 hover:bg-teal-50"
              >
                Get Directions to the Port
              </Link>

              {booking.status === 'confirmed' && (
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  className="inline-block rounded-md bg-teal-700 px-5 py-2.5 text-base font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadingInvoice ? 'Preparing PDF...' : 'Download Invoice (PDF)'}
                </button>
              )}
            </div>
            {downloadError && <p className="mt-2 text-sm text-red-600">{downloadError}</p>}
          </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
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

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="border-b-2 border-gray-100 pb-3 text-base font-semibold uppercase tracking-wide text-gray-500">
              Cancellation
            </h2>

            <div className="mt-4">
              {booking.status === 'cancelled' && (
                <div className="rounded-lg bg-gray-600 p-4 text-base text-white">
  This booking has been cancelled.
</div>
              )}

              {booking.status === 'refund_requested' && (
                <div className="rounded-lg bg-blue-600 p-4 text-base text-white">
                  Your cancellation request has been submitted and is awaiting review. Our team verifies each
                  request manually and sends the refund once approved. This isn't instant.
                </div>
              )}

              {booking.status === 'refunded' && (
                <div className="rounded-lg bg-blue-600 p-4 text-base text-white">
                  This booking was cancelled and your refund has been sent.
                </div>
              )}

              {!alreadyResolved && canCancel && !confirmingCancel && (
                <>
                  <div className="rounded-lg bg-teal-700 p-4 text-base leading-relaxed text-white">
                    You're eligible for a <b>{previewRefundPercent}% refund</b> ({formatPeso(booking.totalFare * previewRefundPercent / 100)}) if
                    you cancel now: {previewRefundPercent === 80
                      ? <>more than 24 hours before departure. That drops to 60% inside the final 24 hours, and <b>{hoursLeft}h {minutesLeft}m</b> left before it does.</>
                      : <>you're within 24 hours of departure, the lowest tier. Cancellations are no longer accepted once departure has passed.</>}
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
                <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 sm:p-5">
                  <p className="text-lg font-bold text-red-800">Request a cancellation?</p>
                  <p className="mt-1.5 text-base leading-relaxed text-gray-700">
                    This submits a cancellation request for manual review it isn't instant. Based on the current
                    time before departure, you're eligible for a{' '}
                    <span className="font-semibold text-red-700">
                      {previewRefundPercent}% refund ({formatPeso(booking.totalFare * previewRefundPercent / 100)})
                    </span>. Our team will verify your reason and send the refund once approved.
                  </p>

                  <div className="mt-4">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Reason for cancellation
                    </label>
                    <select
                      value={cancelReasonCategory}
                      onChange={(e) => setCancelReasonCategory(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-800 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                    >
                      {CANCEL_REASON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {cancelReasonCategory === 'Other' ? 'Please specify' : 'Additional details (optional)'}
                    </label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={3}
                      placeholder={cancelReasonCategory === 'Other' ? 'Tell us why you want to cancel...' : 'Anything else we should know? (optional)'}
                      className="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-800 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                    />
                  </div>

                  <label className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed text-gray-700">
                    <input
                      type="checkbox"
                      checked={cancelConsent}
                      onChange={(e) => setCancelConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 accent-red-600"
                    />
                    <span>
                      I understand this cancellation is subject to Evershine Booking's{' '}
                      <Link to="/refund-cancellation" target="_blank" className="font-medium text-red-700 underline">
                        Refund &amp; Cancellation Policy
                      </Link>
                      , and cannot be reversed once submitted.
                    </span>
                  </label>

                  <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                    <button
                      onClick={confirmCancelBooking}
                      disabled={cancelling || !cancelReasonCategory || (cancelReasonCategory === 'Other' && !cancelReason.trim()) || !cancelConsent}
                      className="flex items-center justify-center gap-2 rounded-md bg-red-600 px-5 py-2.5 text-base font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      {cancelling && (
                        <svg className="h-4 w-4 flex-shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      )}
                      {cancelling ? 'Submitting...' : 'Submit Cancellation Request'}
                    </button>
                    <button
                      onClick={() => { setConfirmingCancel(false); setCancelReasonCategory(''); setCancelReason(''); setCancelConsent(false) }}
                      disabled={cancelling}
                      className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      No, Keep Booking
                    </button>
                  </div>
                </div>
              )}

              {!alreadyResolved && !canCancel && (
               <div className="rounded-lg bg-amber-600 p-4 text-base text-white">
  This booking can no longer be cancelled. Cancellations are only accepted before the scheduled
  departure, and that has already passed. See our{' '}
  <Link to="/refund-cancellation" className="font-medium text-white underline">
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
            placeholder="EBJBCBTA"
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
            placeholder="delacruz@gmail.com"
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

        <aside className="space-y-4">
          <AdSlider />
        </aside>
      </div>
    </div>
  )
}
