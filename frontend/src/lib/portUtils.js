// Save as: frontend/src/lib/portUtils.js
//
// Small shared helpers used by both the landing search form and the
// search results page.

export const PORT_NAMES = {
  PB_TO_LIMASAWA: { from: 'Padre Burgos', to: 'Limasawa' },
  LIMASAWA_TO_PB: { from: 'Limasawa', to: 'Padre Burgos' },
}

// Approximate Padre Burgos <-> Limasawa crossing time. The schedule table
// only stores a departure time, not an arrival time, so this is used to
// show an estimated arrival — adjust here if the real crossing time differs.
export const CROSSING_DURATION_HOURS = 1

// Local calendar date, not UTC — new Date().toISOString() reports the UTC
// date, which lags a full day behind Philippine time (UTC+8) for the first
// several hours of every local day. Using that as "today" made date pickers
// (and the min= bound on them) compute yesterday overnight, letting an
// already-past date still be selected/navigated to. Same class of bug as
// the email invoice timezone fix elsewhere in this app — centralized here
// so every page computes "today" the same, correct way.
export function todayLocalDateString() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function oppositeDirection(direction) {
  return direction === 'PB_TO_LIMASAWA' ? 'LIMASAWA_TO_PB' : 'PB_TO_LIMASAWA'
}

export function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })
}

export function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}