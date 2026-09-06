import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'

// Guest checkout has no account, so there's nothing like customer.emailVerified
// to check — this page is where that gets proven instead, live, via a
// one-time code. It's reached from Booking.jsx's "Verify My Email" button,
// which hands over everything the passenger has typed so far via router
// state; this page hands it right back (plus the verification result) once
// they're done, so nothing they filled in gets lost along the way.
export default function GuestVerifyEmail() {
  const location = useLocation()
  const navigate = useNavigate()
  const { email, passengers, addressCodes, returnSearch } = location.state || {}
  const backToBookingUrl = `/booking${returnSearch || ''}`

  const [status, setStatus] = useState('idle') // idle | sending | sent | verifying | error
  const [message, setMessage] = useState('')
  const [code, setCode] = useState('')
  const sentOnceRef = useRef(false)

  async function sendCode() {
    setStatus('sending')
    setMessage('')
    try {
      const data = await api.sendGuestCode(email)
      setStatus('sent')
      setMessage(data.message || 'Code sent — check your inbox.')
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  // Send the first code automatically on arrival — the passenger already
  // asked for this by clicking "Verify My Email" on the previous page.
  useEffect(() => {
    if (!email || sentOnceRef.current) return
    sentOnceRef.current = true
    sendCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  async function handleVerify() {
    if (code.trim().length !== 6) return
    setStatus('verifying')
    setMessage('')
    try {
      const data = await api.verifyGuestCode(email, code.trim())
      navigate(backToBookingUrl, {
        replace: true,
        state: {
          passengers,
          addressCodes,
          guestVerifiedEmail: email,
          guestVerificationToken: data.token,
          // Tells Booking.jsx to jump straight to Review instead of landing
          // back on the form the passenger already finished filling in.
          autoAdvance: true,
        },
      })
    } catch (err) {
      setStatus('sent') // back to code-entry so they can retry
      setMessage(err.message)
    }
  }

  function handleBack() {
    navigate(backToBookingUrl, { replace: true, state: { passengers, addressCodes } })
  }

  // Reached directly (bookmarked, refreshed after the state expired some
  // other way, etc.) without a booking in progress to return to.
  if (!email) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-gray-800">Nothing to Verify</h1>
        <p className="mt-2 text-sm text-gray-600">
          We couldn't find a booking in progress. Start a new search to book a trip.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Search Trips
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold text-gray-800">Verify Your Email</h1>
      <p className="mt-2 text-sm text-gray-600">
        Booking as a guest requires confirming you own this email address before your ticket can be issued.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-700">
          {status === 'sending' ? "We're sending a 6-digit code to " : 'We sent a 6-digit code to '}
          <b>{email}</b>. It expires in 10 minutes.
        </p>

        <label className="mt-4 block text-sm font-medium text-gray-700">Verification Code</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          disabled={status === 'sending'}
          autoFocus
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.4em] disabled:bg-gray-100"
        />

        {message && (
          <p className={`mt-2 text-sm ${status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>{message}</p>
        )}

        <button
          type="button"
          onClick={handleVerify}
          disabled={status === 'sending' || status === 'verifying' || code.trim().length !== 6}
          className="mt-4 w-full rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
        >
          {status === 'verifying' ? 'Verifying...' : 'Verify Code'}
        </button>

        <button
          type="button"
          onClick={sendCode}
          disabled={status === 'sending' || status === 'verifying'}
          className="mt-3 w-full text-center text-sm font-medium text-teal-700 underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'sending' ? 'Sending...' : "Didn't get a code? Send another"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleBack}
        className="mt-4 text-sm font-medium text-gray-600 underline"
      >
        ← Back to booking details
      </button>
    </div>
  )
}
