import type { TravelEstimate, TravelQuery } from '../../types'

export interface MapsProvider {
  readonly source: 'google' | 'mock'
  estimate(query: TravelQuery): Promise<TravelEstimate>
}

export class TravelLookupError extends Error {}
