import { describe, expect, it } from 'vitest'
import { MockConditionsProvider } from '../conditions/mock'
import { buildPlan } from '../schedule'
import type { ConditionsProvider } from '../conditions'
import type { CallDetails, Conditions, LatLng, Preferences, TravelEstimate, TravelQuery } from '../../types'
import type { MapsProvider } from '../maps'

const LOT: LatLng = { latitude: 40.7128, longitude: -74.006 }

const prefs: Preferences = {
  startPlaceId: 'home',
  places: [{ id: 'home', label: 'Home', address: '433 Warren St' }],
  getReadyMinutes: 30,
  arriveEarlyMinutes: 15,
  onTimeThreshold: 0.9,
}

function callOn(date: Date): CallDetails {
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: '06:00',
    reportAddress: 'Base Camp Lot B',
    travelMode: 'drive',
  }
}

class StubMaps implements MapsProvider {
  readonly source = 'mock' as const
  constructor(private readonly destination?: LatLng) {}
  async estimate(_query: TravelQuery): Promise<TravelEstimate> {
    return {
      optimisticMinutes: 35,
      expectedMinutes: 45,
      pessimisticMinutes: 65,
      distanceMeters: 30000,
      source: 'mock',
      destination: this.destination,
    }
  }
}

class ExplodingConditions implements ConditionsProvider {
  readonly source = 'mock' as const
  async forecast(): Promise<Conditions | null> {
    throw new Error('forecast service down')
  }
}

const tomorrowAt6 = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d
}

describe('MockConditionsProvider', () => {
  const provider = new MockConditionsProvider()

  it('forecasts within range', async () => {
    const c = await provider.forecast(LOT, new Date(Date.now() + 20 * 3_600_000))
    expect(c).not.toBeNull()
    expect(typeof c!.temperatureF).toBe('number')
    expect(c!.summary.length).toBeGreaterThan(0)
  })

  it('refuses to forecast past the range Google actually covers', async () => {
    expect(await provider.forecast(LOT, new Date(Date.now() + 400 * 3_600_000))).toBeNull()
  })

  it('refuses to forecast the past', async () => {
    expect(await provider.forecast(LOT, new Date(Date.now() - 3_600_000))).toBeNull()
  })

  it('is stable for the same place and day', async () => {
    const when = new Date(Date.now() + 20 * 3_600_000)
    const a = await provider.forecast(LOT, when)
    const b = await provider.forecast(LOT, when)
    expect(a).toEqual(b)
  })

  it('keeps precipitation chance a percentage', async () => {
    const c = await provider.forecast(LOT, new Date(Date.now() + 30 * 3_600_000))
    expect(c!.precipitationChance).toBeGreaterThanOrEqual(0)
    expect(c!.precipitationChance).toBeLessThanOrEqual(100)
  })
})

describe('conditions in the plan', () => {
  it('attaches them to the plan when a destination is known', async () => {
    const plan = await buildPlan(
      callOn(tomorrowAt6()), prefs, new StubMaps(LOT), new Date(), new MockConditionsProvider(),
    )
    expect(plan.conditions).toBeDefined()
  })

  it('skips them when routing returned no coordinates', async () => {
    const plan = await buildPlan(
      callOn(tomorrowAt6()), prefs, new StubMaps(undefined), new Date(), new MockConditionsProvider(),
    )
    expect(plan.conditions).toBeUndefined()
  })

  it('still produces a plan when the forecast service fails', async () => {
    const plan = await buildPlan(
      callOn(tomorrowAt6()), prefs, new StubMaps(LOT), new Date(), new ExplodingConditions(),
    )
    // The alarm is the product; conditions are garnish.
    expect(plan.conditions).toBeUndefined()
    expect(plan.wakeAt).toBeInstanceOf(Date)
    expect(plan.onTimeLikelihood).toBeGreaterThan(0)
  })

  it('omits them for a call beyond the forecast horizon', async () => {
    const farOut = new Date()
    farOut.setDate(farOut.getDate() + 25)
    const plan = await buildPlan(
      callOn(farOut), prefs, new StubMaps(LOT), new Date(), new MockConditionsProvider(),
    )
    expect(plan.conditions).toBeUndefined()
  })

  it('leaves them out entirely when no provider is supplied', async () => {
    const plan = await buildPlan(callOn(tomorrowAt6()), prefs, new StubMaps(LOT))
    expect(plan.conditions).toBeUndefined()
  })
})
