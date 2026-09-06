// Save as: frontend/src/pages/RefundCancellation.jsx

import { Link } from 'react-router-dom'

const STEPS = [
  { n: 1, label: 'Go to Manage Booking', detail: 'Open Manage Booking from the menu above.' },
  { n: 2, label: 'Enter your details', detail: 'Your reference code and the email used at checkout.' },
  { n: 3, label: 'Submit your reason', detail: "Select \"Cancel This Booking\" and tell us why, within 24 hours of booking." },
  { n: 4, label: 'Wait for review', detail: 'Our team verifies your request and sends the refund manually once approved.' },
]


// Single static landscape ad poster shown above the page title. Not a
// slider, drop one banner image into frontend/public/ and point this at
// it; object-contain keeps the poster's own text/logo from being cropped.
const AD_BANNER_IMAGE = '/parola-refund.png'

export default function RefundCancellation() {
  return (
    <div className="mx-auto max-w-5xl">
      {AD_BANNER_IMAGE && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <img
            src={AD_BANNER_IMAGE}
            alt="Promotion"
            className="aspect-[3/1] w-full object-contain"
          />
        </div>
      )}

      <h1 className="text-4xl font-bold text-gray-800">Refund &amp; Cancellation</h1>
      <p className="mt-1 text-lg text-gray-600">
        How cancellations and refunds work for trips booked through Evershine Booking.
      </p>

      {/* 4-step process. Left plain (no color accent) since the numbered
          circles already give each step its own visual anchor; adding
          border colors here would compete with the two content cards below
          instead of supporting them. */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {STEPS.map((step) => (
          <div key={step.n} className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-700">
              {step.n}
            </div>
            <p className="mt-3 text-lg font-semibold text-gray-800">{step.label}</p>
            <p className="mt-1 text-base text-gray-500">{step.detail}</p>
          </div>
        ))}
      </div>

      {/* Policy: teal left-border accent marks this as the primary,
          customer-initiated cancellation policy (same solid-color-accent
          pattern used on Manage Booking's cards; no icons, no gradients). */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 text-justify shadow-sm sm:p-8">
        <h2 className="text-2xl font-semibold text-gray-800">Cancellation Policy</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
          <table className="w-full text-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold text-gray-600">When you request cancellation</th>
                <th className="px-5 py-3.5 text-left font-semibold text-gray-600">Outcome</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-5 py-3.5">Within 24 hours of making the booking</td>
                <td className="px-5 py-3.5 font-medium text-teal-700">Eligible for a refund, pending review</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-5 py-3.5">More than 24 hours after booking</td>
                <td className="px-5 py-3.5 font-medium text-red-600">Not eligible for cancellation or refund</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-lg leading-relaxed text-gray-600">
          The cancellation window is based on when you made the booking, not how far away departure is. Manage
          Booking will only show a "Cancel This Booking" option while you're still within 24 hours of your
          original purchase. Once that window has passed, or your booking has already been cancelled, it can no
          longer be changed.
        </p>
        <p className="mt-2 text-lg leading-relaxed text-gray-600">
          Refunds are <span className="font-medium text-gray-800">not automatic</span>. Submitting a cancellation
          request puts your booking under review, then an admin manually checks the reason you provide and sends
          the refund themselves once it's approved. You'll see the status update on your booking (Manage Booking
          or your account's booking history) as it moves from under review to refunded.
        </p>
      </div>

      {/* Trip cancelled by us: blue left-border accent, distinguishing this
          company-initiated scenario from the customer-initiated policy
          above. */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 text-justify shadow-sm sm:p-8">
        <h2 className="text-2xl font-semibold text-gray-800">If We Cancel Your Trip</h2>
        <p className="mt-2 text-lg leading-relaxed text-gray-600">
          If a sailing is cancelled on our end, most often due to a weather advisory from PAGASA or the
          Philippine Coast Guard, you're entitled to a full refund regardless of how close to departure it is,
          or a free rebooking onto the next available trip. This isn't subject to the 24-hour window above since
          it isn't a cancellation you're requesting. We'll reach out using the contact details on your booking,
          and the refund is still sent manually once confirmed.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <Link
          to="/manage-booking"
          className="rounded-md bg-teal-700 px-8 py-3.5 text-lg font-medium text-white hover:bg-teal-800"
        >
          Manage My Booking
        </Link>
      </div>
    </div>
  )
}
