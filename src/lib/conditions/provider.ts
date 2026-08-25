import type { DayOutlook, LatLng, ThermalPreference } from '../../types'

export interface ConditionsProvider {
  readonly source: 'google' | 'mock'
  /**
   * The shoot day starting at `callAt`. Returns null rather than throwing when
   * the forecast does not reach that far — a missing strip is fine, a broken
   * plan is not.
   */
  outlook(at: LatLng, callAt: Date, preference: ThermalPreference): Promise<DayOutlook | null>
}

/** A shoot day is long; these are the points worth bracketing. */
export const MIDDAY_OFFSET_HOURS = 6
export const END_OFFSET_HOURS = 12
