/** Travel modes a performer might use to get to a report location. */
export type TravelMode = 'drive' | 'transit' | 'bike' | 'walk'

/** A saved place — home by default, but also any lot or stage worth keeping. */
export interface Place {
  id: string
  label: string
  address: string
}

/**
 * Personal preferences. These are the things a performer states once and
 * reuses on every job: where they start from, how long they take to get
 * ready, and how early they like to be standing at the lot.
 */
export interface Preferences {
  startPlaceId: string
  places: Place[]
  getReadyMinutes: number
  arriveEarlyMinutes: number
  travelMode: TravelMode
  /** Minimum acceptable on-time likelihood before the plan is flagged. */
  onTimeThreshold: number
}

/** The job-specific details, entered fresh for each call. */
export interface CallDetails {
  /** ISO date, e.g. "2026-08-23". */
  date: string
  /** 24h local time, e.g. "05:45". */
  time: string
  /** Where you physically report — often a parking lot or basecamp, not the set. */
  reportAddress: string
  /** Free text: gate number, lot name, production, whatever helps. */
  note: string
  /** Set once the performer has eyeballed the address and confirmed it. */
  addressConfirmed: boolean
}

/**
 * A traffic-aware travel estimate. `optimistic` and `pessimistic` bracket
 * `expected`; the width of that bracket is what drives the late-risk model.
 */
export interface TravelEstimate {
  optimisticMinutes: number
  expectedMinutes: number
  pessimisticMinutes: number
  distanceMeters: number
  /** Which provider produced this, so the UI can say when it is running on mock data. */
  source: 'google' | 'mock'
}

export interface TravelQuery {
  origin: string
  destination: string
  mode: TravelMode
  /** When the performer would depart. Traffic estimates are time-of-day sensitive. */
  departAt: Date
}

/** The computed plan — everything the performer needs on one screen. */
export interface Plan {
  callAt: Date
  /** When you want to be standing there, i.e. call time minus your early buffer. */
  targetArrivalAt: Date
  leaveAt: Date
  wakeAt: Date
  travel: TravelEstimate
  /** Arrival if traffic runs as badly as the provider thinks it plausibly could. */
  worstCaseArrivalAt: Date
  onTimeLikelihood: number
  /** True when the pessimistic case puts you at the lot after call time. */
  couldBeLate: boolean
  /** True when the wake time has already passed. */
  wakeTimeHasPassed: boolean
}
