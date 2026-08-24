import { GoogleConditionsProvider } from './google'
import { MockConditionsProvider } from './mock'
import type { ConditionsProvider } from './provider'

export type { ConditionsProvider } from './provider'

/** Live forecast when a key is present, a plausible stand-in otherwise. */
export function createConditionsProvider(): ConditionsProvider {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  return key ? new GoogleConditionsProvider(key) : new MockConditionsProvider()
}
