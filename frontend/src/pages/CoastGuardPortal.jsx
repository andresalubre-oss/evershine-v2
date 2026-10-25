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
      navigate('/admin')
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
          navigate('/admin')
        }
      } finally {
        setLoading(false)
      }
    })()
   
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
    navigate('/admin')
  }

  const now = new Date()
  const upcoming = schedules
    .filter((s) => new Date(s.departureDatetime) >= now)
    .sort((a, b) => new Date(a.departureDatetime) - new Date(b.departureDatetime))


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

  const nextSailing = upcoming[0]
  const todayCount = upcoming.filter((s) => new Date(s.departureDatetime).toDateString() === now.toDateString()).length
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

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
        {me && (
          <div className="mb-5">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {greeting}, {me.name?.split(' ')[0] || 'Officer'}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {me.coastGuardStation ? ` · ${me.coastGuardStation} Station` : ''}
            </p>
          </div>
        )}

        {!loading && (
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Next sailing</p>
              {nextSailing ? (
                <>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                    {new Date(nextSailing.departureDatetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {dayLabel(new Date(nextSailing.departureDatetime))} · {directionLabel[nextSailing.direction] || nextSailing.direction}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">None scheduled</p>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Sailings today</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{todayCount}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{upcoming.length} upcoming in total</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Manifests received</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{manifests.length}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Ready to download as PDF</p>
            </div>
          </div>
        )}

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
                  <span className="ml-auto rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
                    {upcoming.length}
                  </span>
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
                            const isNext = s.id === nextSailing?.id
                            const booked = typeof available === 'number' && capacity ? capacity - available : null
                            const pct = booked !== null ? Math.min(100, Math.round((booked / capacity) * 100)) : 0
                            return (
                              <div
                                key={s.id}
                                className={`rounded-md border px-3 py-2.5 ${
                                  isNext
                                    ? 'border-teal-300 dark:border-teal-700 bg-teal-50/60 dark:bg-teal-900/20'
                                    : 'border-gray-100 dark:border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-100">
                                    {new Date(s.departureDatetime).toLocaleTimeString('en-US', {
                                      hour: 'numeric', minute: '2-digit',
                                    })}
                                    {isNext && (
                                      <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                        Next
                                      </span>
                                    )}
                                  </p>
                                  {booked !== null && (
                                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300">
                                      {booked} / {capacity} <span className="text-gray-400 dark:text-slate-500">on board</span>
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                                  {directionLabel[s.direction] || s.direction}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{s.ferry?.name || 'Ferry TBD'}</p>
                                {booked !== null && (
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                                    <div
                                      className={`h-full rounded-full ${lowSeats ? 'bg-red-500' : 'bg-teal-600'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

          
              <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 px-4 py-3.5">
                  <IconFileText className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Manifests Shared With You</p>
                </div>
                {manifests.length === 0 ? (
                  <div className="flex flex-col items-center px-4 py-8 text-center">
                    <IconFileText className="h-8 w-8 text-gray-300 dark:text-slate-600" />
                    <p className="mt-2 text-sm font-medium text-gray-700 dark:text-slate-300">No manifests yet</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                      Manifests sent by Evershine admins will appear here.
                    </p>
                  </div>
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
