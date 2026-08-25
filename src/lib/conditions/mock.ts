import type { Conditions, DayOutlook, LatLng, ThermalPreference } from '../../types'
import { END_OFFSET_HOURS, MIDDAY_OFFSET_HOURS, type ConditionsProvider } from './provider'
import { recommendWardrobe, windChillF } from '../wardrobe'

const MAX_FORECAST_HOURS = 240

/** Stable pseudo-random in [0,1) so a given place and day do not jitter. */
function hashUnit(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 100000) / 100000
}

const SUMMARIES = ['Clear', 'Partly cloudy', 'Cloudy', 'Light rain', 'Fog']
const POLLEN_CATEGORIES = ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high']
const POLLEN_TYPES = ['Tree', 'Grass', 'Weed']

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000)
}

/** Same shape as the live provider, including its refusal to over-reach. */
export class MockConditionsProvider implements ConditionsProvider {
  readonly source = 'mock' as const

  async outlook(
    at: LatLng,
    callAt: Date,
    preference: ThermalPreference,
  ): Promise<DayOutlook | null> {
    const hoursOut = (callAt.getTime() - Date.now()) / 3_600_000
    if (hoursOut < 0 || hoursOut + END_OFFSET_HOURS > MAX_FORECAST_HOURS) return null

    const seed = hashUnit(`${at.latitude.toFixed(2)},${at.longitude.toFixed(2)},${callAt.toDateString()}`)
    const summary = SUMMARIES[Math.floor(seed * SUMMARIES.length)]

    const point = (when: Date): Conditions => {
      // Peaks at 15:00 and bottoms out before dawn, which is the shape a
      // pre-dawn call actually runs into.
      const diurnal = Math.cos(((when.getHours() - 15) / 24) * 2 * Math.PI) * 11
      const temperatureF = Math.round(58 + seed * 20 + diurnal)
      // Afternoons are windier than dawns.
      const windMph = Math.round(3 + seed * 14 + Math.max(0, diurnal) * 0.6)
      return {
        at: when,
        temperatureF,
        feelsLikeF: Math.round(windChillF(temperatureF, windMph)),
        windMph,
        summary,
        precipitationChance:
          summary === 'Light rain' ? Math.round(40 + seed * 45) : Math.round(seed * 20),
      }
    }

    const start = point(callAt)
    const midday = point(addHours(callAt, MIDDAY_OFFSET_HOURS))
    const end = point(addHours(callAt, END_OFFSET_HOURS))
    const { items, swingNote, windNote } = recommendWardrobe([start, midday, end], preference)

    const pollenIndex = Math.floor(seed * 6)

    return {
      start,
      midday,
      end,
      pollen: pollenIndex > 0
        ? {
            index: pollenIndex,
            category: POLLEN_CATEGORIES[pollenIndex],
            type: POLLEN_TYPES[Math.floor(seed * POLLEN_TYPES.length)],
          }
        : undefined,
      wardrobe: items,
      swingNote,
      windNote,
      source: 'mock',
    }
  }
}
