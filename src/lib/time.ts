const MS_PER_MINUTE = 60_000

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE)
}

export function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_MINUTE
}

/** Build a local Date from an ISO date ("2026-08-23") and 24h time ("05:45"). */
export function combineDateAndTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

export function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "5:45 AM" — the form that reads fastest on a screenshot. */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** "Sun Aug 23" — enough to catch a wake time that lands on the day before. */
export function formatDay(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "1h 20m", "45m". Durations are always shown, never bare minute counts. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/** Whole calendar days from `now` to `date`, ignoring the time of day. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * "Tomorrow: Tue Aug 26" — the near days get named because that is how anyone
 * talks about a call, and everything else just states the date.
 */
export function formatRelativeDay(date: Date, now: Date = new Date()): string {
  const day = date
    .toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
  const offset = daysUntil(date, now)
  if (offset === 0) return `Today: ${day}`
  if (offset === 1) return `Tomorrow: ${day}`
  return day
}

/** True when `a` and `b` fall on different calendar days. */
export function isDifferentDay(a: Date, b: Date): boolean {
  return toDateInput(a) !== toDateInput(b)
}
