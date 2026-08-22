import { describe, expect, it } from 'vitest'
import { buildPlan } from '../schedule'
import type { MapsProvider } from '../maps'
import type { CallDetails, Preferences, TravelEstimate, TravelQuery } from '../../types'
import { formatClock } from '../time'

const prefs: Preferences = {
  startPlaceId: 'home',
  places: [{ id: 'home', label: 'Home', address: '433 Warren St' }],
  getReadyMinutes: 30,
  arriveEarlyMinutes: 15,
  travelMode: 'drive',
  onTimeThreshold: 0.9,
}

const call: CallDetails = {
  date: '2026-09-14',
  time: '06:00',
  reportAddress: 'Base Camp Lot B',
  note: '',
  addressConfirmed: true,
}

/** Fixed 45-minute trip, so the arithmetic is checkable by hand. */
class FixedProvider implements MapsProvider {
  readonly source = 'mock' as const
  calls: TravelQuery[] = []
  constructor(private readonly estimate_: TravelEstimate) {}
  async estimate(query: TravelQuery): Promise<TravelEstimate> {
    this.calls.push(query)
    return this.estimate_
  }
}

const fixed = (o: number, e: number, p: number): TravelEstimate => ({
  optimisticMinutes: o,
  expectedMinutes: e,
  pessimisticMinutes: p,
  distanceMeters: 30000,
  source: 'mock',
})

const NOW = new Date('2026-09-13T12:00:00')

describe('buildPlan', () => {
  it('works backwards from call time through buffer, travel and getting ready', async () => {
    const provider = new FixedProvider(fixed(35, 45, 65))
    const plan = await buildPlan(call, prefs, provider, NOW)

    expect(formatClock(plan.callAt)).toBe(formatClock(new Date('2026-09-14T06:00:00')))
    // 06:00 call, 15 min early buffer -> want to be standing there at 05:45.
    expect(formatClock(plan.targetArrivalAt)).toBe(formatClock(new Date('2026-09-14T05:45:00')))
    // 45 min drive before that -> leave at 05:00.
    expect(formatClock(plan.leaveAt)).toBe(formatClock(new Date('2026-09-14T05:00:00')))
    // 30 min to get ready -> alarm at 04:30.
    expect(formatClock(plan.wakeAt)).toBe(formatClock(new Date('2026-09-14T04:30:00')))
  })

  it('flags that being late is possible when the pessimistic case overruns call', async () => {
    // Leaving at 05:00 with a 65-minute worst case lands at 06:05 — past call.
    const plan = await buildPlan(call, prefs, new FixedProvider(fixed(35, 45, 65)), NOW)
    expect(plan.couldBeLate).toBe(true)
  })

  it('clears the flag when the buffer absorbs the worst case', async () => {
    // Worst case 58 min from 05:00 arrives 05:58, inside the 06:00 call.
    const plan = await buildPlan(call, prefs, new FixedProvider(fixed(41, 45, 58)), NOW)
    expect(plan.couldBeLate).toBe(false)
  })

  it('re-queries the provider with the refined departure time', async () => {
    const provider = new FixedProvider(fixed(35, 45, 65))
    await buildPlan(call, prefs, provider, NOW)

    // One seed lookup plus the refinement passes.
    expect(provider.calls.length).toBe(3)
    const last = provider.calls[provider.calls.length - 1]
    expect(formatClock(last.departAt)).toBe(formatClock(new Date('2026-09-14T05:00:00')))
    expect(last.origin).toBe('433 Warren St')
    expect(last.destination).toBe('Base Camp Lot B')
  })

  it('marks a wake time that has already gone by', async () => {
    const tooLate = new Date('2026-09-14T05:00:00')
    const plan = await buildPlan(call, prefs, new FixedProvider(fixed(35, 45, 65)), tooLate)
    expect(plan.wakeTimeHasPassed).toBe(true)
  })

  it('pushes the alarm to the previous day for a pre-dawn call', async () => {
    const nightCall = { ...call, time: '00:30' }
    const plan = await buildPlan(nightCall, prefs, new FixedProvider(fixed(35, 45, 65)), NOW)
    expect(plan.wakeAt.getDate()).toBe(13)
    expect(formatClock(plan.wakeAt)).toBe(formatClock(new Date('2026-09-13T23:00:00')))
  })

  it('gives a longer trip a later alarm', async () => {
    const short = await buildPlan(call, prefs, new FixedProvider(fixed(15, 20, 30)), NOW)
    const long = await buildPlan(call, prefs, new FixedProvider(fixed(80, 90, 110)), NOW)
    expect(long.wakeAt.getTime()).toBeLessThan(short.wakeAt.getTime())
  })
})
