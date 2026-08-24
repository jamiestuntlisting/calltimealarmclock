import type { Conditions, LatLng } from '../../types'

export interface ConditionsProvider {
  readonly source: 'google' | 'mock'
  /**
   * Conditions at a place at a moment. Returns null rather than throwing when
   * the forecast does not reach that far out — a missing strip is fine, a
   * broken plan is not.
   */
  forecast(at: LatLng, when: Date): Promise<Conditions | null>
}
