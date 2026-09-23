// Save as: frontend/src/components/ChatPanel.jsx
//
// Shared Coast Guard coordination chat — used both inside Admin.jsx (a
// "Coast Guard" tab) and on the standalone Coast Guard portal page. Works
// identically in both places since it derives everything from whichever
// account's token is in localStorage; it doesn't need to know whether it's
// rendering for an admin or a coast_guard account.
//
// Live delivery is socket.io, with two deliberate fallbacks so a flaky
// connection (or Render's free-tier backend going to sleep after 15 min
// idle, then taking ~1 min to wake back up) never makes the chat look
// broken rather than just momentarily behind:
//   1. REST history is (re)loaded on connect/reconnect, not just once on
//      mount, so a gap while disconnected gets backfilled automatically.
//   2. If Send is clicked while the socket isn't connected, it falls back
//      to a plain REST POST instead of silently failing.
// Messages are de-duplicated by id, since the same message can arrive via
// both the live socket event and a REST history refresh.

import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { api } from '../api.js'

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')

function formatMessageTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
  })
}

function roleLabel(role, station) {
  if (role === 'coast_guard') return station ? `Coast Guard — ${station}` : 'Coast Guard'
  return 'Evershine Admin'
}

function ConnectionStatus({ status }) {
  const config = {
    connected: { color: 'bg-green-600', label: 'Live' },
    connecting: { color: 'bg-amber-600', label: 'Connecting…' },
    reconnecting: { color: 'bg-amber-600', label: 'Reconnecting…' },
    disconnected: { color: 'bg-gray-400', label: 'Offline — messages will send once reconnected' },
  }[status] || { color: 'bg-gray-400', label: status }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-500">
      <span className={`inline-block h-2 w-2 rounded-full ${config.color}`} />
      {config.label}
    </span>
  )
}

export default function ChatPanel({ currentAccountId, className = '' }) {
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('connecting')
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState('')
  const [loadError, setLoadError] = useState('')
  const socketRef = useRef(null)
  const scrollRef = useRef(null)

  const mergeMessages = useCallback((incoming) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      for (const m of incoming) byId.set(m.id, m)
      return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    })
  }, [])

  const loadHistory = useCallback(async () => {
    setLoadError('')
    try {
      const data = await api.getCoastGuardMessages()
      mergeMessages(data)
    } catch (err) {
      setLoadError(err.message)
    }
  }, [mergeMessages])

  useEffect(() => {
    loadHistory()
    api.markCoastGuardChatRead().catch(() => {})

    const token = localStorage.getItem('adminToken')
    const socket = io(SOCKET_URL, { auth: { token }, reconnectionDelay: 1500, reconnectionDelayMax: 8000 })
    socketRef.current = socket

    socket.on('connect', () => {
      setStatus('connected')
      // Backfills anything sent while we were disconnected — cheap, and
      // the id-based merge means this never creates duplicates.
      loadHistory()
      api.markCoastGuardChatRead().catch(() => {})
    })
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('reconnect_attempt', () => setStatus('reconnecting'))
    socket.on('connect_error', () => setStatus('disconnected'))
    socket.on('new_message', (message) => {
      mergeMessages([message])
      api.markCoastGuardChatRead().catch(() => {})
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  async function handleSend() {
    const body = draft.trim()
    if (!body) return
    setSendError('')
    setDraft('')

    const socket = socketRef.current
    if (socket?.connected) {
      socket.emit('send_message', { body }, (ack) => {
        if (ack?.error) {
          setSendError(ack.error)
          setDraft(body)
        } else if (ack?.message) {
          mergeMessages([ack.message])
        }
      })
      return
    }

    // Socket isn't up right now — REST fallback so Send still works.
    try {
      const message = await api.sendCoastGuardMessageRest(body)
      mergeMessages([message])
    } catch (err) {
      setSendError(err.message)
      setDraft(body)
    }
  }

  return (
    <div className={`flex h-[32rem] flex-col rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Coast Guard Coordination</p>
        <ConnectionStatus status={status} />
      </div>

      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
        {messages.length === 0 && !loadError ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">No messages yet say hello.</p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === currentAccountId
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <span className="mb-1 text-[11px] text-gray-400 dark:text-slate-500">
                  {roleLabel(m.senderRole, m.senderStation)} · {formatMessageTime(m.createdAt)}
                </span>
                <div
                  className={`max-w-[80%] rounded-lg px-3.5 py-2 text-sm ${
                    isMine ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-slate-800 p-3">
        {sendError && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{sendError}</p>}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            placeholder="Message the other side…"
            maxLength={2000}
            className="flex-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
