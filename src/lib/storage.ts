import type { CallDetails, Preferences } from '../types'
import { toDateInput } from './time'

const PREFS_KEY = 'calltime.preferences.v1'
const CALL_KEY = 'calltime.lastCall.v1'

export const DEFAULT_PREFERENCES: Preferences = {
  startPlaceId: 'home',
  places: [{ id: 'home', label: 'Home', address: '' }],
  getReadyMinutes: 30,
  arriveEarlyMinutes: 15,
  travelMode: 'drive',
  onTimeThreshold: 0.9,
}

export function defaultCallDetails(now: Date = new Date()): CallDetails {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return {
    date: toDateInput(tomorrow),
    time: '06:00',
    reportAddress: '',
    note: '',
    addressConfirmed: false,
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    // Merge over the fallback so a stored blob from an older build cannot
    // leave a newly added field undefined.
    return { ...fallback, ...(JSON.parse(raw) as T) }
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing or a full quota — the app still works for this session.
  }
}

export function loadPreferences(): Preferences {
  const prefs = read(PREFS_KEY, DEFAULT_PREFERENCES)
  return prefs.places.length > 0 ? prefs : { ...prefs, places: DEFAULT_PREFERENCES.places }
}

export function savePreferences(prefs: Preferences): void {
  write(PREFS_KEY, prefs)
}

/**
 * The call details carry over between sessions, minus the confirmation — a new
 * day means the address has to be eyeballed again.
 */
export function loadCallDetails(): CallDetails {
  const stored = read(CALL_KEY, defaultCallDetails())
  return { ...stored, addressConfirmed: false }
}

export function saveCallDetails(call: CallDetails): void {
  write(CALL_KEY, call)
}
