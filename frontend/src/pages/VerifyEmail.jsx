// Save as: frontend/src/pages/VerifyEmail.jsx

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState('checking') // 'checking' | 'success' | 'error'
  const [error, setError] = useState('')
  const { refreshMe } = useAuth()

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('This link is missing its verification token.')
      return
    }
    let cancelled = false
    api.verifyEmail(token)
      .then(async () => {
        if (cancelled) return
        // Without this, the customer object cached in AuthContext (loaded
        // once when the app started) would still show emailVerified: false
        // for the rest of the session — e.g. still blocking them from
        // booking — even though the server-side flag just flipped to true.
        await refreshMe()
        if (!cancelled) setStatus('success')
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error')
          setError(err.message)
        }
      })
    return () => { cancelled = true }
  }, [token, refreshMe])

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        {status === 'checking' && (
          <>
            <h1 className="text-xl font-bold text-gray-800">Verifying your email...</h1>
            <p className="mt-2 text-sm text-gray-500">Just a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-800">Email Verified</h1>
            <p className="mt-2 text-sm text-gray-600">Your email address is confirmed. You're all set.</p>
            <Link
              to="/account"
              className="mt-6 inline-block rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Go to My Account
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-800">Verification Failed</h1>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <p className="mt-4 text-sm text-gray-500">
              Log in and use "Resend verification email" on your account page to get a new link.
            </p>
            <Link
              to="/account/login"
              className="mt-6 inline-block rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Go to Log In
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
