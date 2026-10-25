export const PORT_NAMES = {
  PB_TO_LIMASAWA: { from: 'Padre Burgos', to: 'Limasawa' },
  LIMASAWA_TO_PB: { from: 'Limasawa', to: 'Padre Burgos' },
}

export const CROSSING_DURATION_HOURS = 1


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