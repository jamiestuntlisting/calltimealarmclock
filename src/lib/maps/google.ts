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

const BASE_FIELDS = 'routes.duration,routes.distanceMeters'
// Transit needs the boarding times and the headway behind each vehicle.
const TRANSIT_FIELDS = `${BASE_FIELDS},routes.legs.steps.transitDetails`

interface TransitDetails {
  headway?: string
  stopDetails?: {
    departureTime?: string
    arrivalTime?: string
  }
}

interface RoutesResponse {
  routes?: Array<{
    duration?: string
    distanceMeters?: number
    legs?: Array<{ steps?: Array<{ transitDetails?: TransitDetails }> }>
  }>
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
      throw new TravelLookupError(
        `Google Routes API returned ${response.status}. Check the key and that Routes API is enabled.`,
      )
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

    return {
      minutes: seconds / 60,
      distanceMeters: route?.distanceMeters ?? 0,
      headwaysMinutes,
      scheduledDepartureAt: firstDeparture ? new Date(firstDeparture) : null,
    }
  }
}
