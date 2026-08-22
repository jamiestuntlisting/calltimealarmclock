import type { TravelEstimate, TravelMode, TravelQuery } from '../../types'
import { type MapsProvider, TravelLookupError } from './provider'

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes'

const TRAVEL_MODE: Record<TravelMode, string> = {
  drive: 'DRIVE',
  transit: 'TRANSIT',
  bike: 'BICYCLE',
  walk: 'WALK',
}

/** Only DRIVE accepts a traffic model, which is where the spread comes from. */
type TrafficModel = 'OPTIMISTIC' | 'BEST_GUESS' | 'PESSIMISTIC'

interface RoutesResponse {
  routes?: Array<{ duration?: string; distanceMeters?: number }>
}

/** Routes API durations come back as protobuf strings like "1834s". */
function parseSeconds(duration: string | undefined): number | null {
  if (!duration) return null
  const match = /^([\d.]+)s$/.exec(duration)
  return match ? Number(match[1]) : null
}

export class GoogleMapsProvider implements MapsProvider {
  readonly source = 'google' as const

  constructor(private readonly apiKey: string) {}

  async estimate(query: TravelQuery): Promise<TravelEstimate> {
    // Traffic models only apply to driving. Everything else gets one lookup,
    // and its spread is inferred downstream from the noise floor.
    if (query.mode !== 'drive') {
      const route = await this.fetchRoute(query, null)
      return {
        optimisticMinutes: route.minutes,
        expectedMinutes: route.minutes,
        pessimisticMinutes: route.minutes,
        distanceMeters: route.distanceMeters,
        source: 'google',
      }
    }

    const [optimistic, expected, pessimistic] = await Promise.all([
      this.fetchRoute(query, 'OPTIMISTIC'),
      this.fetchRoute(query, 'BEST_GUESS'),
      this.fetchRoute(query, 'PESSIMISTIC'),
    ])

    return {
      optimisticMinutes: optimistic.minutes,
      expectedMinutes: expected.minutes,
      pessimisticMinutes: pessimistic.minutes,
      distanceMeters: expected.distanceMeters,
      source: 'google',
    }
  }

  private async fetchRoute(query: TravelQuery, trafficModel: TrafficModel | null) {
    // The Routes API rejects departure times in the past.
    const departureTime = new Date(Math.max(query.departAt.getTime(), Date.now() + 60_000))

    const body: Record<string, unknown> = {
      origin: { address: query.origin },
      destination: { address: query.destination },
      travelMode: TRAVEL_MODE[query.mode],
      departureTime: departureTime.toISOString(),
    }
    if (trafficModel) {
      body.routingPreference = 'TRAFFIC_AWARE_OPTIMAL'
      body.trafficModel = trafficModel
    }

    const response = await fetch(ROUTES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new TravelLookupError(
        `Google Routes API returned ${response.status}. Check the key and that Routes API is enabled.`,
      )
    }

    const data = (await response.json()) as RoutesResponse
    const seconds = parseSeconds(data.routes?.[0]?.duration)
    if (seconds === null) {
      throw new TravelLookupError('No route found between those two addresses.')
    }

    return {
      minutes: seconds / 60,
      distanceMeters: data.routes?.[0]?.distanceMeters ?? 0,
    }
  }
}
