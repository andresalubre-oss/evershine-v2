// Save as: frontend/src/pages/RefundCancellation.jsx

import { Link } from 'react-router-dom'

const STEPS = [
  { n: 1, label: 'Go to Manage Booking', detail: 'Open Manage Booking from the menu above.' },
  { n: 2, label: 'Enter your details', detail: 'Your reference code and the email used at checkout.' },
  { n: 3, label: 'Submit your reason', detail: "Select \"Cancel This Booking\" and tell us why, within 24 hours of booking." },
  { n: 4, label: 'Wait for review', detail: 'Our team verifies your request and sends the refund manually once approved.' },
]

export default function RefundCancellation() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800">Refund &amp; Cancellation</h1>
      <p className="mt-1 text-sm text-gray-600">
        How cancellations and refunds work for trips booked through Evershine Booking.
      </p>

      {/* 4-step process */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {STEPS.map((step) => (
          <div key={step.n} className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
              {step.n}
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-800">{step.label}</p>
            <p className="mt-1 text-xs text-gray-500">{step.detail}</p>
          </div>
        ))}
      </div>

      {/* Policy */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-gray-800">Cancellation Policy</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">When you request cancellation</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Outcome</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">Within 24 hours of making the booking</td>
                <td className="px-3 py-2 font-medium text-teal-700">Eligible for a refund, pending review</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">More than 24 hours after booking</td>
                <td className="px-3 py-2 font-medium text-red-600">Not eligible for cancellation or refund</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          The cancellation window is based on when you made the booking — not how far away departure is. Manage
          Booking will only show a "Cancel This Booking" option while you're still within 24 hours of your
          original purchase. Once that window has passed, or your booking has already been cancelled, it can no
          longer be changed.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Refunds are <span className="font-medium text-gray-800">not automatic</span>. Submitting a cancellation
          request puts your booking under review — an admin manually checks the reason you provide, then sends
          the refund themselves once it's approved. You'll see the status update on your booking (Manage Booking
          or your account's booking history) as it moves from under review to refunded.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Refund processing time is a placeholder pending your confirmed timeline — update this once finalized.
        </p>
      </div>

      {/* Trip cancelled by us */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-gray-800">If We Cancel Your Trip</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          If a sailing is cancelled on our end — most often due to a weather advisory from PAGASA or the
          Philippine Coast Guard — you're entitled to a full refund regardless of how close to departure it is,
          or a free rebooking onto the next available trip. This isn't subject to the 24-hour window above since
          it isn't a cancellation you're requesting. We'll reach out using the contact details on your booking,
          and the refund is still sent manually once confirmed.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <Link
          to="/manage-booking"
          className="rounded-md bg-teal-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          Manage My Booking
        </Link>
      </div>
    </div>
  )
}
