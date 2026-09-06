// Save as: frontend/src/components/ChatWidget.jsx
//
// Simple FAQ-matching help bot — no AI, no external service, no ongoing
// cost. It scores the visitor's question against lib/faqKnowledge.js by
// shared keywords and replies with the closest match, or a fallback
// message pointing to Travel Info / Contact if nothing scores well enough.

import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { findBestAnswer } from '../lib/faqKnowledge.js'

function IconChat(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}
function IconX(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
function IconSend(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

const GREETING = "Hi! I'm the Evershine Help Bot. Ask me about bookings, baggage, discounts, or cancellations."
const FALLBACK =
  "I couldn't find a close match for that. Try rephrasing, check our Policies / FAQs pages under Travel Info, or reach out to us directly for anything specific to your booking."

const SUGGESTED = [
  'What do I need to present when boarding?',
  'Can I cancel my booking?',
  'How do I get a discount?',
  'How much baggage can I bring?',
]

export default function ChatWidget() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ from: 'bot', text: GREETING }])
  const [input, setInput] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  function ask(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    const match = findBestAnswer(trimmed)
    setMessages((prev) => [
      ...prev,
      { from: 'user', text: trimmed },
      { from: 'bot', text: match ? match.a : FALLBACK },
    ])
    setInput('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    ask(input)
  }

  // Booking.jsx's summary bar is only pinned to the bottom of the screen on
  // a wide viewport (sm: and up) — on mobile it scrolls with the page like
  // everything else. So the chat bubble only needs to float higher there
  // too, on sm: and up; on mobile it can stay at the usual spot.
  const isBookingPage = location.pathname === '/booking'

  return (
    <div className={`fixed bottom-5 right-5 z-50 ${isBookingPage ? 'sm:bottom-24' : ''}`}>
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex flex-shrink-0 items-center justify-between bg-teal-700 px-4 py-3 text-white">
            <p className="text-sm font-semibold">Evershine Help</p>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded p-1 hover:bg-white/10">
              <IconX className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    m.from === 'user' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-left text-xs font-medium text-teal-700 hover:bg-teal-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-shrink-0 items-center gap-2 border-t border-gray-200 p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              aria-label="Send"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-teal-700 text-white hover:bg-teal-800"
            >
              <IconSend className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close help chat' : 'Open help chat'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg transition-colors hover:bg-teal-800"
      >
        {open ? <IconX className="h-6 w-6" /> : <IconChat className="h-6 w-6" />}
      </button>
    </div>
  )
}
