import { GooglePlacesProvider } from './google'
import { MockPlacesProvider } from './mock'
import type { PlacesProvider } from './provider'

export type { PlaceSuggestion, PlacesProvider } from './provider'

/** Live suggestions when a key is present, a bundled address list otherwise. */
export function createPlacesProvider(): PlacesProvider {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  return key ? new GooglePlacesProvider(key) : new MockPlacesProvider()
}

/**
 * Google bills autocomplete per session: every keystroke up to the pick shares
 * one token, which is then retired. Anything unique works as the token.
 */
export function newSessionToken(): string {
  return crypto.randomUUID()
}
