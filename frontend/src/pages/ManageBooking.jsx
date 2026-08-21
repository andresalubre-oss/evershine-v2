import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

function fullName(p) {
  return [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ')
}

export default function ManageBooking() {
  const [referenceCode, setReferenceCode] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')
  const [cancelMessage, setCancelMessage] = useState('')
  const [cancelError, setCancelError] = useState(false)

  async function lookupBooking() {
    setError('')
    setCancelMessage('')
    try {
      const data = await api.lookupBooking(referenceCode.trim().toUpperCase(), contactEmail.trim())
      setBooking(data)
    } catch (err) {
      setBooking(null)
      setError(err.message)
    }
  }

  async function cancelBooking() {
    setCancelMessage('')
    setCancelError(false)
    try {
      await api.cancelBooking(booking.referenceCode, booking.contactEmail)
      lookupBooking()
    } catch (err) {
      setCancelMessage(err.message)
      setCancelError(true)
    }
  }

  const departureTime = booking ? new Date(booking.schedule.departureDatetime) : null
  const hoursUntilDeparture = departureTime ? (departureTime - new Date()) / (1000 * 60 * 60) : 0
  const canCancel = booking && booking.status !== 'cancelled' && hoursUntilDeparture >= 24

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-gray-800">Manage Your Booking</h1>
      <p className="mt-1 text-gray-600">Enter your reference code and email to view or cancel your booking.</p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">Reference Code</label>
        <input
          type="text"
          placeholder="e.g. EBJBCBTA"
          value={referenceCode}
          onChange={(e) => setReferenceCode(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <label className="mt-3 block text-sm font-medium text-gray-700">Email used when booking</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <button
          onClick={lookupBooking}
          className="mt-4 rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800"
        >
          Find My Booking
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {booking && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p><b>Reference Code:</b> {booking.referenceCode}</p>
          <p className="mt-1"><b>Trip:</b> {departureTime.toLocaleString()}</p>
          <p className="mt-1">
            <b>Status:</b>{' '}
            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize">
              {booking.status.replace('_', ' ')}
            </span>
          </p>
          <p className="mt-1"><b>Total Fare:</b> &#8369;{booking.totalFare}</p>

          <Link
            to={`/directions?direction=${booking.schedule.direction}`}
            className="mt-3 inline-block rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
          >
            Get Directions to the Port
          </Link>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-1">Passenger</th>
                <th className="py-1">Discount</th>
                <th className="py-1">Fare</th>
              </tr>
            </thead>
            <tbody>
              {booking.passengers.map((p, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1">{fullName(p)}</td>
                  <td className="py-1">{p.discountType}</td>
                  <td className="py-1">&#8369;{p.fare}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {canCancel && (
            <button
              onClick={cancelBooking}
              className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Cancel This Booking
            </button>
          )}
          {!canCancel && booking.status !== 'cancelled' && (
            <p className="mt-4 text-sm text-red-600">Cannot cancel within 24 hours of departure.</p>
          )}
          {cancelMessage && (
            <p className={`mt-3 text-sm ${cancelError ? 'text-red-600' : 'text-teal-700'}`}>
              {cancelMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
