import type { TravelEstimate, TravelMode, TravelQuery } from '../../types'
import { type MapsProvider, TravelLookupError } from './provider'

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes'

const TRAVEL_MODE: Record<TravelMode, string> = {
  drive: 'DRIVE',
  transit: 'TRANSIT',
  bike: 'BICYCLE',
  walk: 'WALK',
}

/** Only DRIVE accepts a traffic model, which is where the driving spread comes from. */
type TrafficModel = 'OPTIMISTIC' | 'BEST_GUESS' | 'PESSIMISTIC'

// endLocation rides along free and spares a separate geocoding request.
const BASE_FIELDS = 'routes.duration,routes.distanceMeters,routes.legs.endLocation'
// Transit needs the boarding times and the headway behind each vehicle.
const TRANSIT_FIELDS = `${BASE_FIELDS},routes.legs.steps.transitDetails`

interface TransitDetails {
  headway?: string
  stopDetails?: {
    departureTime?: string
    arrivalTime?: string
  }
}

interface RouteLeg {
  steps?: Array<{ transitDetails?: TransitDetails }>
  endLocation?: { latLng?: { latitude?: number; longitude?: number } }
}

interface RoutesResponse {
  routes?: Array<{
    duration?: string
    distanceMeters?: number
    legs?: RouteLeg[]
  }>
}

/**
 * Google says exactly what is wrong in the response body — which referrer was
 * blocked, which API is not enabled on the key. Surfacing the status code
 * alone throws away the only useful part of the answer.
 */
async function describeFailure(response: Response, api: string): Promise<string> {
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    detail = body.error?.message ?? ''
  } catch {
    // Non-JSON error body; the status code is all we have.
  }
  return detail
    ? `Google ${api} API: ${detail}`
    : `Google ${api} API returned ${response.status}.`
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
    if (query.mode === 'transit') return this.estimateTransit(query)
    if (query.mode !== 'drive') return this.estimateFixed(query)
    return this.estimateDriving(query)
  }

  /**
   * Driving risk is traffic, so the spread comes from running the same route
   * through Google's three traffic models.
   */
  private async estimateDriving(query: TravelQuery): Promise<TravelEstimate> {
    const [optimistic, expected, pessimistic] = await Promise.all([
      this.fetchRoute(query, { trafficModel: 'OPTIMISTIC' }),
      this.fetchRoute(query, { trafficModel: 'BEST_GUESS' }),
      this.fetchRoute(query, { trafficModel: 'PESSIMISTIC' }),
    ])

    return {
      optimisticMinutes: optimistic.minutes,
      expectedMinutes: expected.minutes,
      pessimisticMinutes: pessimistic.minutes,
      distanceMeters: expected.distanceMeters,
      source: 'google',
      destination: expected.destination,
    }
  }

  /**
   * Transit risk is not traffic — it is missing a connection. Google answers
   * arrival-time queries against the timetable, so we ask the question a
   * commuter actually asks ("what gets me there by call?") and read the
   * downside off the headway: the wait until the next departure.
   */
  private async estimateTransit(query: TravelQuery): Promise<TravelEstimate> {
    const route = await this.fetchRoute(query, { transit: true })

    const worstHeadway = route.headwaysMinutes.length
      ? Math.max(...route.headwaysMinutes)
      : 0

    return {
      // A timetable cannot be beaten, so the scheduled trip is the best case.
      optimisticMinutes: route.minutes,
      expectedMinutes: route.minutes,
      pessimisticMinutes: route.minutes + worstHeadway,
      distanceMeters: route.distanceMeters,
      source: 'google',
      destination: route.destination,
      oneSidedSpread: true,
      scheduledDepartureAt: route.scheduledDepartureAt ?? undefined,
      missedConnectionMinutes: worstHeadway || undefined,
      transitLegs: route.headwaysMinutes.length || undefined,
    }
  }

  /** Walking and cycling have no timetable and no traffic model — one lookup. */
  private async estimateFixed(query: TravelQuery): Promise<TravelEstimate> {
    const route = await this.fetchRoute(query, {})
    return {
      optimisticMinutes: route.minutes,
      expectedMinutes: route.minutes,
      pessimisticMinutes: route.minutes,
      distanceMeters: route.distanceMeters,
      source: 'google',
      destination: route.destination,
    }
  }

  private async fetchRoute(
    query: TravelQuery,
    options: { trafficModel?: TrafficModel; transit?: boolean },
  ) {
    const body: Record<string, unknown> = {
      origin: { address: query.origin },
      destination: { address: query.destination },
      travelMode: TRAVEL_MODE[query.mode],
    }

    if (query.timing.type === 'arrive') {
      // Transit is the only mode Google will solve backwards from an arrival.
      body.arrivalTime = query.timing.by.toISOString()
    } else {
      // Departure times in the past are rejected for every mode but transit.
      const earliest = query.mode === 'transit' ? 0 : Date.now() + 60_000
      body.departureTime = new Date(
        Math.max(query.timing.at.getTime(), earliest),
      ).toISOString()
    }

    if (options.trafficModel) {
      body.routingPreference = 'TRAFFIC_AWARE_OPTIMAL'
      body.trafficModel = options.trafficModel
    }

    const response = await fetch(ROUTES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': options.transit ? TRANSIT_FIELDS : BASE_FIELDS,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new TravelLookupError(await describeFailure(response, 'Routes'))
    }

    const data = (await response.json()) as RoutesResponse
    const route = data.routes?.[0]
    const seconds = parseSeconds(route?.duration)
    if (seconds === null) {
      throw new TravelLookupError(
        query.mode === 'transit'
          ? 'No transit route found — check the addresses, or that transit runs at that hour.'
          : 'No route found between those two addresses.',
      )
    }

    const transitSteps = (route?.legs ?? [])
      .flatMap((leg) => leg.steps ?? [])
      .map((step) => step.transitDetails)
      .filter((details): details is TransitDetails => Boolean(details))

    const headwaysMinutes = transitSteps
      .map((details) => parseSeconds(details.headway))
      .filter((s): s is number => s !== null)
      .map((s) => s / 60)

    const firstDeparture = transitSteps[0]?.stopDetails?.departureTime
    const legs = route?.legs ?? []
    const end = legs[legs.length - 1]?.endLocation?.latLng

    return {
      minutes: seconds / 60,
      distanceMeters: route?.distanceMeters ?? 0,
      headwaysMinutes,
      scheduledDepartureAt: firstDeparture ? new Date(firstDeparture) : null,
      destination:
        end?.latitude !== undefined && end?.longitude !== undefined
          ? { latitude: end.latitude, longitude: end.longitude }
          : undefined,
    }
  }
}
