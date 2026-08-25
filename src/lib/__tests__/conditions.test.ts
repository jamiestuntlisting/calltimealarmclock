import { describe, expect, it } from 'vitest'
import { MockConditionsProvider } from '../conditions/mock'
import { buildPlan } from '../schedule'
import type { ConditionsProvider } from '../conditions'
import type { CallDetails, DayOutlook, LatLng, Preferences, TravelEstimate, TravelQuery } from '../../types'
import type { MapsProvider } from '../maps'

const LOT: LatLng = { latitude: 40.7128, longitude: -74.006 }

const prefs: Preferences = {
  startPlaceId: 'home',
  places: [{ id: 'home', label: 'Home', address: '433 Warren St' }],
  getReadyMinutes: 30,
  arriveEarlyMinutes: 15,
  thermalPreference: 'average',
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
  async outlook(): Promise<DayOutlook | null> {
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
  const soon = () => new Date(Date.now() + 20 * 3_600_000)

  it('brackets the day with three points', async () => {
    const o = (await provider.outlook(LOT, soon(), 'average'))!
    expect(o).not.toBeNull()
    // Six hours between each, so the day spans twelve.
    expect((o.midday.at.getTime() - o.start.at.getTime()) / 3_600_000).toBe(6)
    expect((o.end.at.getTime() - o.start.at.getTime()) / 3_600_000).toBe(12)
  })

  it('recommends something to wear', async () => {
    const o = (await provider.outlook(LOT, soon(), 'average'))!
    expect(o.wardrobe.length).toBeGreaterThan(0)
  })

  it('dresses someone who runs cold more warmly', async () => {
    const when = soon()
    const cold = (await provider.outlook(LOT, when, 'cold'))!
    const warm = (await provider.outlook(LOT, when, 'warm'))!
    // Same weather, different person: the colder one never wears less.
    expect(cold.wardrobe.join()).not.toBe(warm.wardrobe.join())
  })

  it('refuses when the whole day does not fit in the forecast', async () => {
    // Inside 240h at the call, but the twelve-hour day runs past the edge.
    const edge = new Date(Date.now() + 239 * 3_600_000)
    expect(await provider.outlook(LOT, edge, 'average')).toBeNull()
  })

  it('refuses to forecast the past', async () => {
    expect(await provider.outlook(LOT, new Date(Date.now() - 3_600_000), 'average')).toBeNull()
  })

  it('is stable for the same place and day', async () => {
    const when = soon()
    expect(await provider.outlook(LOT, when, 'average')).toEqual(
      await provider.outlook(LOT, when, 'average'),
    )
  })

  it('keeps precipitation chance a percentage', async () => {
    const o = (await provider.outlook(LOT, soon(), 'average'))!
    for (const p of [o.start, o.midday, o.end]) {
      expect(p.precipitationChance).toBeGreaterThanOrEqual(0)
      expect(p.precipitationChance).toBeLessThanOrEqual(100)
    }
  })
})

describe('outlook in the plan', () => {
  it('attaches them to the plan when a destination is known', async () => {
    const plan = await buildPlan(
      callOn(tomorrowAt6()), prefs, new StubMaps(LOT), new Date(), new MockConditionsProvider(),
    )
    expect(plan.outlook).toBeDefined()
  })

  it('skips them when routing returned no coordinates', async () => {
    const plan = await buildPlan(
      callOn(tomorrowAt6()), prefs, new StubMaps(undefined), new Date(), new MockConditionsProvider(),
    )
    expect(plan.outlook).toBeUndefined()
  })

  it('still produces a plan when the forecast service fails', async () => {
    const plan = await buildPlan(
      callOn(tomorrowAt6()), prefs, new StubMaps(LOT), new Date(), new ExplodingConditions(),
    )
    // The alarm is the product; conditions are garnish.
    expect(plan.outlook).toBeUndefined()
    expect(plan.wakeAt).toBeInstanceOf(Date)
    expect(plan.onTimeLikelihood).toBeGreaterThan(0)
  })

  it('omits them for a call beyond the forecast horizon', async () => {
    const farOut = new Date()
    farOut.setDate(farOut.getDate() + 25)
    const plan = await buildPlan(
      callOn(farOut), prefs, new StubMaps(LOT), new Date(), new MockConditionsProvider(),
    )
    expect(plan.outlook).toBeUndefined()
  })

  it('leaves them out entirely when no provider is supplied', async () => {
    const plan = await buildPlan(callOn(tomorrowAt6()), prefs, new StubMaps(LOT))
    expect(plan.outlook).toBeUndefined()
  })
})
