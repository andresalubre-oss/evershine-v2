// Save as: frontend/src/pages/CoastGuardPortal.jsx
//
// Minimal portal for Coast Guard accounts — just enough to see upcoming
// sailings and coordinate with Evershine admins over chat. No booking,
// customer, or financial data is reachable from here; the backend also
// enforces this independently (requireAdminOrCoastGuard only opens the
// schedules-read and chat routes to a coast_guard-role token — every other
// admin route still requires 'admin' specifically).
//
// Styled to match the Admin Panel's dark teal header (same logo, same
// "EVERSHINE BOOKING" wordmark treatment) so it reads as the same trusted
// system, just a smaller, purpose-built slice of it — not a separate app.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import ChatPanel from '../components/ChatPanel.jsx'

const directionLabel = {
  PB_TO_LIMASAWA: 'Padre Burgos → Limasawa',
  LIMASAWA_TO_PB: 'Limasawa → Padre Burgos',
}

function IconAnchor(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="5" r="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v14M7 12H3a9 9 0 0018 0h-4" />
      <path strokeLinecap="round" d="M9 9l-2 2M15 9l2 2" />
    </svg>
  )
}

function IconFerry(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 15l1.5 4.5a2 2 0 001.9 1.4h9.2a2 2 0 001.9-1.4L20 15" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 15V9a2 2 0 012-2h8a2 2 0 012 2v6" />
      <path strokeLinecap="round" d="M12 7V3M10 3h4" />
    </svg>
  )
}

function IconLogout(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

function IconFileText(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 13h6M9 17h6M9 9h1" />
    </svg>
  )
}

function IconDownload(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" />
    </svg>
  )
}

function initialsOf(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('') || 'CG'
}

export default function CoastGuardPortal() {
  const navigate = useNavigate()
  const [me, setMe] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [manifests, setManifests] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      navigate('/login')
      return
    }
    ;(async () => {
      try {
        const [meData, scheduleData, manifestData] = await Promise.all([
          api.getCoastGuardMe(),
          api.getAdminSchedules(),
          api.getCoastGuardManifests(),
        ])
        setMe(meData)
        setSchedules(scheduleData)
        setManifests(manifestData)
      } catch (err) {
        setMessage(err.message)
        if (err.message?.toLowerCase().includes('log in')) {
          localStorage.removeItem('adminToken')
          navigate('/login')
        }
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDownloadManifest(m) {
    setDownloadingId(m.id)
    try {
      const dateStr = new Date(m.schedule.departureDatetime).toISOString().slice(0, 10)
      await api.downloadCoastGuardManifestPdf(m.id, `evershine-manifest-${dateStr}.pdf`)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setDownloadingId(null)
    }
  }

  function handleLogout() {
    api.adminLogout().catch(() => {})
    localStorage.removeItem('adminToken')
    navigate('/login')
  }

  const now = new Date()
  const upcoming = schedules
    .filter((s) => new Date(s.departureDatetime) >= now)
    .sort((a, b) => new Date(a.departureDatetime) - new Date(b.departureDatetime))

  // Grouped by calendar day so a busy week reads as a scannable agenda
  // instead of one long flat list — "Today" / "Tomorrow" beat a raw date
  // for a duty audience checking this in passing.
  const groupedByDay = upcoming.reduce((groups, s) => {
    const day = new Date(s.departureDatetime)
    const key = day.toDateString()
    if (!groups[key]) groups[key] = { date: day, sailings: [] }
    groups[key].sailings.push(s)
    return groups
  }, {})

  function dayLabel(date) {
    const diffDays = Math.round((new Date(date.toDateString()) - new Date(now.toDateString())) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950">
      {/* Header — deliberately mirrors the Admin Panel's dark teal sidebar
          header (same logo badge, same wordmark treatment) so a Coast Guard
          user immediately reads this as the same system, just their slice
          of it, not a separate/less-trustworthy site. */}
      <header className="bg-teal-950 shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
              <img src="/admin-evershine-logo.png" alt="Evershine" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase leading-tight tracking-wider text-teal-400">
                Evershine Booking
              </p>
              <p className="flex items-center gap-1.5 text-[15px] font-bold leading-tight text-white">
                <IconAnchor className="h-4 w-4 text-teal-400" />
                Coast Guard Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {me && (
              <div className="hidden items-center gap-2.5 sm:flex">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                  {initialsOf(me.name)}
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-sm font-semibold text-white">{me.name}</span>
                  <span className="block text-xs text-teal-300">{me.coastGuardStation || 'Station not set'} Station</span>
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md border border-teal-800 bg-teal-900 px-3 py-1.5 text-sm font-medium text-teal-100 hover:bg-teal-800"
            >
              <IconLogout className="h-4 w-4" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* Short orientation banner — this audience opens the portal
            infrequently, so a one-line reminder of what it's for and isn't
            for is worth the space every time. */}
        <div className="mb-5 rounded-lg border border-teal-100 dark:border-teal-900/40 bg-teal-50 dark:bg-teal-950/40 px-4 py-3">
          <p className="text-sm text-teal-900 dark:text-teal-200">
            Padre Burgos ↔ Limasawa sailing schedule and a direct line to Evershine's dispatch team for coordination
            around weather, delays, or incidents. Booking, customer, and payment information are not part of this portal.
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16">
            <p className="text-sm text-gray-500 dark:text-slate-500">Loading portal…</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="space-y-5 lg:col-span-2">
              <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 px-4 py-3.5">
                  <IconFerry className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Upcoming Sailings</p>
                </div>
                {upcoming.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-500 dark:text-slate-500">No upcoming sailings scheduled.</p>
                ) : (
                  <div className="no-scrollbar max-h-[20rem] space-y-4 overflow-y-auto px-4 py-4">
                    {Object.values(groupedByDay).map(({ date, sailings }) => (
                      <div key={date.toDateString()}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                          {dayLabel(date)}
                        </p>
                        <div className="space-y-2">
                          {sailings.map((s) => {
                            const capacity = s.ferry?.seatCapacity
                            const available = s.availableSeats
                            const lowSeats = typeof available === 'number' && capacity && available <= capacity * 0.15
                            return (
                              <div
                                key={s.id}
                                className="rounded-md border border-gray-100 dark:border-slate-800 px-3 py-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                                    {new Date(s.departureDatetime).toLocaleTimeString('en-US', {
                                      hour: 'numeric', minute: '2-digit',
                                    })}
                                  </p>
                                  {typeof available === 'number' && (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        lowSeats
                                          ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300'
                                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
                                      }`}
                                    >
                                      {available} / {capacity} seats
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-500">
                                  {directionLabel[s.direction] || s.direction} · {s.ferry?.name || 'Ferry TBD'}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manifests shared from the admin dashboard's "Send Manifest"
                  action — shown here directly instead of relying on this
                  account's actual email inbox, which the portal has no way
                  to check. The PDF is regenerated fresh on every download,
                  so it always reflects the current passenger list even if
                  this was sent a while ago. */}
              <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 px-4 py-3.5">
                  <IconFileText className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Manifests Shared With You</p>
                </div>
                {manifests.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-500 dark:text-slate-500">
                    Nothing here yet — Evershine admins can send a sailing's manifest from their dashboard.
                  </p>
                ) : (
                  <div className="no-scrollbar max-h-[20rem] space-y-2 overflow-y-auto px-4 py-4">
                    {manifests.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-100 dark:border-slate-800 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100">
                            {new Date(m.schedule.departureDatetime).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })}
                          </p>
                          <p className="truncate text-xs text-gray-500 dark:text-slate-500">
                            {directionLabel[m.schedule.direction] || m.schedule.direction} · Sent by {m.sentByName}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownloadManifest(m)}
                          disabled={downloadingId === m.id}
                          className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-teal-700 px-2.5 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 disabled:opacity-50"
                        >
                          <IconDownload className="h-3.5 w-3.5" />
                          {downloadingId === m.id ? 'Downloading…' : 'PDF'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3">
              <ChatPanel currentAccountId={me?.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
