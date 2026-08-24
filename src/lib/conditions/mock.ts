import type { Conditions, LatLng } from '../../types'
import type { ConditionsProvider } from './provider'

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

/**
 * Stand-in with the same shape as the live provider, including the refusal to
 * forecast beyond the range Google actually covers.
 */
export class MockConditionsProvider implements ConditionsProvider {
  readonly source = 'mock' as const

  async forecast(at: LatLng, when: Date): Promise<Conditions | null> {
    const hoursOut = (when.getTime() - Date.now()) / 3_600_000
    if (hoursOut < 0 || hoursOut > MAX_FORECAST_HOURS) return null

    const seed = hashUnit(`${at.latitude.toFixed(2)},${at.longitude.toFixed(2)},${when.toDateString()}`)
    const summary = SUMMARIES[Math.floor(seed * SUMMARIES.length)]
    // Dawn calls are the cold ones; the swing is roughly diurnal.
    const hour = when.getHours()
    const diurnal = Math.cos(((hour - 15) / 24) * 2 * Math.PI) * 11

    const pollenIndex = Math.floor(seed * 6)

    return {
      temperatureF: Math.round(58 + seed * 20 - diurnal),
      summary,
      precipitationChance: summary === 'Light rain' ? Math.round(40 + seed * 45) : Math.round(seed * 20),
      pollen: pollenIndex > 0
        ? {
            index: pollenIndex,
            category: POLLEN_CATEGORIES[pollenIndex],
            type: POLLEN_TYPES[Math.floor(seed * POLLEN_TYPES.length)],
          }
        : undefined,
      source: 'mock',
    }
  }
}
