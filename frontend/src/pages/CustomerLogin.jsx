// Save as: frontend/src/pages/CustomerLogin.jsx
// (Separate from the existing admin Login.jsx / /login route.)

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

function IconEye(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconEyeOff(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.6 5.1A9.9 9.9 0 0112 5c6 0 9.5 7 9.5 7a15.8 15.8 0 01-3.1 4.1M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 7 9.5 7a9.4 9.4 0 004.4-1.1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 9.9a3 3 0 004.2 4.2" />
    </svg>
  )
}
function IconAlert(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1 1 0 003 19.5h18a1 1 0 00.89-1.46L13.71 3.86a1 1 0 00-1.72 0z" />
    </svg>
  )
}
function IconSpinner(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// Background photo for the full-bleed hero behind the login card. Swap this
// for any other photo already in frontend/public/ — nothing else needs to
// change.
const HERO_IMAGE = '/hero-6.jpg'

export default function CustomerLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await api.customerLogin(email, password)
      login(data.token, data.customer)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // Full-bleed photo hero — same left-1/2/-mt-28/-ml-[50vw]/w-screen trick
    // used on the Book page to break out of the centered <main> column and
    // cancel Layout's pt-28 nav clearance, then re-add breathing room via
    // this section's own py. The login card sits centered in the middle of
    // the photo (flex items-center), not straddling its bottom edge like the
    // Book page's search card.
    <div
      className="relative left-1/2 -mt-28 -ml-[50vw] flex w-screen items-center justify-center bg-cover bg-center px-4 py-28 sm:py-36"
      style={{ backgroundImage: `url(${HERO_IMAGE})` }}
    >
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative w-full max-w-lg">
        <h1 className="text-3xl font-bold text-white drop-shadow sm:text-4xl">Log In</h1>
        <p className="mt-2 text-base text-white/90 drop-shadow sm:text-lg">
         Manage your bookings and discounts.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-xl sm:p-8"
        >
          <div>
            <label className="block text-base font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 pr-10 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 mt-1.5 flex items-center px-3 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-base text-red-700">
              <IconAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-6 py-3 text-base font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <IconSpinner className="h-4 w-4 animate-spin" />}
            {submitting ? 'Logging in...' : 'Log In'}
          </button>

          <p className="text-center text-base text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-teal-700 hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}