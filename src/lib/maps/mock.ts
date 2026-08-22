import type { TravelEstimate, TravelQuery } from '../../types'
import type { MapsProvider } from './provider'

/** Stable pseudo-random in [0,1) from a string, so a route does not jitter between renders. */
function hashUnit(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 100000) / 100000
}

const BASE_SPEED_KPH: Record<TravelQuery['mode'], number> = {
  drive: 45,
  transit: 22,
  bike: 16,
  walk: 5,
}

/**
 * How much worse than free-flow the trip runs, by hour of departure. Only
 * driving and transit feel this; a bike lane does not care about rush hour.
 */
function congestionFactor(hour: number): number {
  if (hour >= 6 && hour < 10) return 1.45
  if (hour >= 15 && hour < 19) return 1.6
  if (hour >= 10 && hour < 15) return 1.15
  return 1.0
}

/** Width of the optimistic/pessimistic bracket, as a fraction of expected. */
function spreadFactor(mode: TravelQuery['mode'], congestion: number): number {
  if (mode === 'walk') return 0.06
  if (mode === 'bike') return 0.1
  if (mode === 'transit') return 0.22
  return 0.18 * congestion
}

/**
 * Stand-in for the Routes API so the whole app works without a key. Distances
 * are invented from the address text, but the shape of the answer — a best
 * guess bracketed by an optimistic and pessimistic duration, varying with
 * departure time — matches what Google returns.
 */
export class MockMapsProvider implements MapsProvider {
  readonly source = 'mock' as const

  async estimate(query: TravelQuery): Promise<TravelEstimate> {
    const seed = hashUnit(`${query.origin}->${query.destination}`)
    const distanceKm = 4 + seed * 38
    const congestion = query.mode === 'bike' || query.mode === 'walk'
      ? 1
      : congestionFactor(query.departAt.getHours())

    const expected = (distanceKm / BASE_SPEED_KPH[query.mode]) * 60 * congestion
    const spread = expected * spreadFactor(query.mode, congestion)

    return {
      optimisticMinutes: Math.max(1, expected - spread),
      expectedMinutes: Math.max(1, expected),
      // Bad traffic has a long right tail; the upside is capped, the downside is not.
      pessimisticMinutes: Math.max(1, expected + spread * 1.8),
      distanceMeters: Math.round(distanceKm * 1000),
      source: 'mock',
    }
  }
}
