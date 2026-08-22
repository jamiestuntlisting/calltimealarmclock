import { GoogleMapsProvider } from './google'
import { MockMapsProvider } from './mock'
import type { MapsProvider } from './provider'

export { TravelLookupError } from './provider'
export type { MapsProvider } from './provider'

/**
 * Live routing when a key is present, mock otherwise. Dropping a key into
 * .env.local is the only change needed to go live.
 */
export function createMapsProvider(): MapsProvider {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  return key ? new GoogleMapsProvider(key) : new MockMapsProvider()
}
