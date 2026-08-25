import type { Conditions, DayOutlook, LatLng, PollenReading, ThermalPreference } from '../../types'
import { END_OFFSET_HOURS, MIDDAY_OFFSET_HOURS, type ConditionsProvider } from './provider'
import { recommendWardrobe } from '../wardrobe'

const WEATHER_ENDPOINT = 'https://weather.googleapis.com/v1/forecast/hours:lookup'
const POLLEN_ENDPOINT = 'https://pollen.googleapis.com/v1/forecast:lookup'

/** Hourly weather reaches 240 hours; daily pollen reaches 5 days. */
const MAX_WEATHER_HOURS = 240
const MAX_POLLEN_DAYS = 5

interface WeatherHour {
  interval?: { startTime?: string }
  temperature?: { degrees?: number; unit?: string }
  weatherCondition?: { description?: { text?: string } }
  precipitation?: { probability?: { percent?: number } }
}

interface PollenDay {
  date?: { year?: number; month?: number; day?: number }
  pollenTypeInfo?: Array<{
    displayName?: string
    indexInfo?: { value?: number; category?: string }
  }>
}

function toFahrenheit(degrees: number, unit: string | undefined): number {
  return unit === 'FAHRENHEIT' ? degrees : degrees * 1.8 + 32
}

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000
}

export class GoogleConditionsProvider implements ConditionsProvider {
  readonly source = 'google' as const

  constructor(private readonly apiKey: string) {}

  async outlook(
    at: LatLng,
    callAt: Date,
    preference: ThermalPreference,
  ): Promise<DayOutlook | null> {
    const hoursOut = hoursBetween(new Date(), callAt)
    // The whole day has to be in range, not just the call.
    if (hoursOut < 0 || hoursOut + END_OFFSET_HOURS > MAX_WEATHER_HOURS) return null

    const midday = addHours(callAt, MIDDAY_OFFSET_HOURS)
    const end = addHours(callAt, END_OFFSET_HOURS)

    // One weather request covers the whole day; pollen is a separate service.
    const [hours, pollen] = await Promise.all([
      this.fetchHours(at, Math.ceil(hoursOut) + END_OFFSET_HOURS + 1),
      this.fetchPollen(at, callAt).catch(() => undefined),
    ])
    if (!hours) return null

    const start = pick(hours, callAt)
    const points = [start, pick(hours, midday), pick(hours, end)]
    if (points.some((p) => p === null)) return null

    const [s, m, e] = points as Conditions[]
    const { items, swingNote } = recommendWardrobe([s, m, e], preference)

    return { start: s, midday: m, end: e, pollen, wardrobe: items, swingNote, source: 'google' }
  }

  private async fetchHours(at: LatLng, hours: number) {
    const params = new URLSearchParams({
      key: this.apiKey,
      'location.latitude': String(at.latitude),
      'location.longitude': String(at.longitude),
      hours: String(Math.min(hours, MAX_WEATHER_HOURS)),
    })

    const response = await fetch(`${WEATHER_ENDPOINT}?${params}`)
    if (!response.ok) return null

    const data = (await response.json()) as { forecastHours?: WeatherHour[] }
    return data.forecastHours ?? []
  }

  private async fetchPollen(at: LatLng, when: Date): Promise<PollenReading | undefined> {
    const daysOut = Math.floor(hoursBetween(new Date(), when) / 24)
    if (daysOut >= MAX_POLLEN_DAYS) return undefined

    const params = new URLSearchParams({
      key: this.apiKey,
      'location.latitude': String(at.latitude),
      'location.longitude': String(at.longitude),
      days: String(MAX_POLLEN_DAYS),
      plantsDescription: '0',
    })

    const response = await fetch(`${POLLEN_ENDPOINT}?${params}`)
    if (!response.ok) return undefined

    const data = (await response.json()) as { dailyInfo?: PollenDay[] }
    const day = data.dailyInfo?.[daysOut]
    if (!day) return undefined

    // Only the worst pollen type matters — that is the one you react to.
    const worst = (day.pollenTypeInfo ?? [])
      .filter((t) => t.indexInfo?.value !== undefined)
      .sort((a, b) => (b.indexInfo!.value ?? 0) - (a.indexInfo!.value ?? 0))[0]

    if (!worst?.indexInfo?.value) return undefined

    return {
      index: worst.indexInfo.value,
      category: worst.indexInfo.category ?? '',
      type: worst.displayName ?? '',
    }
  }
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000)
}

/** Read one moment out of the hourly series. */
function pick(hours: WeatherHour[], when: Date): Conditions | null {
  const hour = nearestHour(hours, when)
  const degrees = hour?.temperature?.degrees
  if (!hour || degrees === undefined) return null
  return {
    at: when,
    temperatureF: Math.round(toFahrenheit(degrees, hour.temperature?.unit)),
    summary: hour.weatherCondition?.description?.text ?? '',
    precipitationChance: Math.round(hour.precipitation?.probability?.percent ?? 0),
  }
}

/** The forecast hour whose start is closest to the moment we care about. */
function nearestHour(hours: WeatherHour[], when: Date): WeatherHour | undefined {
  let best: WeatherHour | undefined
  let bestGap = Infinity
  for (const hour of hours) {
    const start = hour.interval?.startTime
    if (!start) continue
    const gap = Math.abs(new Date(start).getTime() - when.getTime())
    if (gap < bestGap) {
      bestGap = gap
      best = hour
    }
  }
  return best
}
