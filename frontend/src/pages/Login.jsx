// Save as: frontend/src/pages/Login.jsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function Login() {
  const navigate = useNavigate()

  // step 'password' -> normal email/password form
  // step 'code'      -> shown only when the account has 2FA enabled
  const [step, setStep] = useState('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingToken, setPendingToken] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function finishLogin(data) {
    localStorage.setItem('adminToken', data.token)
    navigate('/admin')
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await api.login(email, password)
      if (data.requiresTwoFactor) {
        setPendingToken(data.pendingToken)
        setStep('code')
      } else {
        finishLogin(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCodeSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await api.verifyLogin2fa(pendingToken, code)
      finishLogin(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function backToPassword() {
    setStep('password')
    setPendingToken(null)
    setCode('')
    setError('')
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-gray-800">Admin Login</h1>

      {step === 'password' ? (
        <form
          onSubmit={handlePasswordSubmit}
          className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {submitting ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleCodeSubmit}
          className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <p className="text-sm text-gray-600">
            Enter the 6-digit code from your authenticator app.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.3em]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {submitting ? 'Verifying...' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={backToPassword}
            className="w-full text-center text-sm text-gray-500 hover:underline"
          >
            Back to log in
          </button>
        </form>
      )}
    </div>
  )
}
