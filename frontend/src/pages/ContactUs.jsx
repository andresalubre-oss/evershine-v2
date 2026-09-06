// Save as: frontend/src/pages/ContactUs.jsx

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

// Same details already shown in Footer.jsx, kept in one place there and
// referenced here so the two never drift out of sync. (Placeholder contact
// details, replace with your real support email, phone number, and
// terminal address.)
const SUPPORT_EMAIL = 'evershine.booking@gmail.com'
const SUPPORT_PHONE = '+63 924565632'
const SUPPORT_PHONE_HREF = '+63924565632'
const TERMINAL_ADDRESS = 'Padre Burgos Port, Southern Leyte, 6600 Philippines'

const QUICK_HELP = [
  { to: '/manage-booking', label: 'Manage Booking', detail: 'Look up, cancel, or check the payment status of an existing booking.' },
  { to: '/refund-cancellation', label: 'Refund & Cancellation', detail: 'See the cancellation window and how refunds are processed.' },
  { to: '/travel-info/faqs', label: 'FAQs', detail: 'Boarding requirements, baggage, discounts, and other common questions.' },
]

export default function ContactUs() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  const canSend = name.trim() && email.trim() && message.trim() && status !== 'sending'

  const AD_BANNER_IMAGE = '/magallanes-port.png'

  // Sent straight from the backend via Resend; the visitor never leaves
  // this page or has to open their own email app.
  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSend) return
    setStatus('sending')
    setError('')
    try {
      await api.sendContactMessage(name.trim(), email.trim(), message.trim())
      setStatus('sent')
      setName('')
      setEmail('')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setError(err.message || "Couldn't send your message. Please try again.")
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
       {AD_BANNER_IMAGE && (
  <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
    <img
      src={AD_BANNER_IMAGE}
      alt="Promotion"
      className="aspect-[3/1] w-full object-cover"
    />
  </div>
)}
      <h1 className="text-4xl font-bold text-gray-800">Contact Us</h1>
      <p className="mt-1 text-lg text-gray-600">
        Questions about a booking, a trip, or anything else, here's how to reach us.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Email</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-1 block text-lg font-semibold text-teal-700 hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Phone</p>
          <a href={`tel:${SUPPORT_PHONE_HREF}`} className="mt-1 block text-lg font-semibold text-teal-700 hover:underline">
            {SUPPORT_PHONE}
          </a>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Terminal</p>
          <p className="mt-1 text-lg font-semibold text-gray-800">Padre Burgos Terminal</p>
          <p className="mt-0.5 text-base text-gray-500">{TERMINAL_ADDRESS}</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-semibold text-gray-800">Send Us a Message</h2>
        <p className="mt-1 text-lg text-gray-600">We'll reply to the email address you provide below.</p>

        {status === 'sent' ? (
          <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-4">
            <p className="text-lg font-semibold text-teal-800">Message sent, we'll get back to you soon.</p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-2 text-base font-medium text-teal-700 hover:underline"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-base text-gray-600">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base"
                />
              </div>
              <div>
                <label className="block text-base text-gray-600">Your Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. juandelacruz@email.com"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base"
                />
              </div>
            </div>

            <label className="mt-3 block text-base text-gray-600">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="How can we help?"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base"
            />

            {status === 'error' && <p className="mt-2 text-base text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={!canSend}
              className="mt-4 rounded-md bg-teal-700 px-6 py-2.5 text-base font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {status === 'sending' ? 'Sending...' : 'Send Message'}
            </button>
            {status !== 'sending' && !canSend && (
              <p className="mt-2 text-sm text-gray-500">Fill in your name, email, and a message first.</p>
            )}
          </form>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-semibold text-gray-800">Looking for Something Specific?</h2>
        <p className="mt-1 text-lg text-gray-600">These usually get you an answer faster than waiting on a reply.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {QUICK_HELP.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md border border-gray-200 p-4 hover:border-teal-200 hover:bg-teal-50"
            >
              <p className="text-base font-semibold text-teal-700">{item.label}</p>
              <p className="mt-1 text-sm text-gray-500">{item.detail}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
