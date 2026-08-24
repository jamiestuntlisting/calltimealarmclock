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
  /**
   * How you are getting there. Lives on the call rather than in preferences
   * because the same person drives to one job and takes the train to the next.
   */
  travelMode: TravelMode
}

/**
 * A travel estimate. `optimistic` and `pessimistic` bracket `expected`; the
 * width of that bracket is what drives the late-risk model.
 */
export interface TravelEstimate {
  optimisticMinutes: number
  expectedMinutes: number
  pessimisticMinutes: number
  distanceMeters: number
  /** Which provider produced this, so the UI can say when it is running on mock data. */
  source: 'google' | 'mock'
  /**
   * True when the spread only runs one way. Driving can beat its own estimate;
   * a timetable cannot, so transit's bracket is downside-only and the risk
   * model reads its width as a single tail rather than two.
   */
  oneSidedSpread?: boolean
  /**
   * Transit only: the timetable departure this plan is built around, from an
   * arrival-time query. This is a real train, not a derived clock time.
   */
  scheduledDepartureAt?: Date
  /**
   * Transit only: minutes lost to the next departure if a connection is
   * missed — Google's headway. This is what transit risk actually is.
   */
  missedConnectionMinutes?: number
  /** Transit only: how many separate vehicles the trip involves. */
  transitLegs?: number
}

/**
 * Anchor a route to a departure time or to a required arrival. Driving wants
 * "leave at X, how long?"; transit wants "what gets me there by X?", which is
 * how the timetable is actually read.
 */
export type TravelTiming =
  | { type: 'depart'; at: Date }
  | { type: 'arrive'; by: Date }

export interface TravelQuery {
  origin: string
  destination: string
  mode: TravelMode
  timing: TravelTiming
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
