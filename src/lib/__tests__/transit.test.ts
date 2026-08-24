import { describe, expect, it } from 'vitest'
import { buildPlan } from '../schedule'
import { onTimeLikelihood, travelSigma } from '../risk'
import { MockMapsProvider } from '../maps/mock'
import type { MapsProvider } from '../maps'
import type { CallDetails, Preferences, TravelEstimate, TravelQuery } from '../../types'
import { formatClock } from '../time'

const basePrefs: Preferences = {
  startPlaceId: 'home',
  places: [{ id: 'home', label: 'Home', address: '433 Warren St, Brooklyn NY' }],
  getReadyMinutes: 30,
  arriveEarlyMinutes: 15,
  onTimeThreshold: 0.9,
}

const call: CallDetails = {
  date: '2026-09-14',
  time: '06:00',
  reportAddress: 'Silvercup Studios, Queens NY',
  travelMode: 'transit',
}

const NOW = new Date('2026-09-13T12:00:00')

class RecordingProvider implements MapsProvider {
  readonly source = 'mock' as const
  calls: TravelQuery[] = []
  constructor(private readonly result: TravelEstimate) {}
  async estimate(query: TravelQuery): Promise<TravelEstimate> {
    this.calls.push(query)
    return this.result
  }
}

const transitEstimate = (
  minutes: number,
  headway: number,
  scheduledDepartureAt?: Date,
): TravelEstimate => ({
  optimisticMinutes: minutes,
  expectedMinutes: minutes,
  pessimisticMinutes: minutes + headway,
  distanceMeters: 12000,
  source: 'mock',
  oneSidedSpread: true,
  scheduledDepartureAt,
  missedConnectionMinutes: headway,
  transitLegs: 1,
})

describe('transit routing', () => {
  it('asks the timetable what gets you there, rather than iterating departures', async () => {
    const provider = new RecordingProvider(transitEstimate(40, 10))
    await buildPlan(call, basePrefs, provider, NOW)

    // One question, not a seed plus refinement passes.
    expect(provider.calls.length).toBe(1)
    const [query] = provider.calls
    expect(query.timing.type).toBe('arrive')
    if (query.timing.type === 'arrive') {
      // Anchored to the early-buffer arrival, not to call time itself.
      expect(formatClock(query.timing.by)).toBe(formatClock(new Date('2026-09-14T05:45:00')))
    }
  })

  it('leaves on the real scheduled departure, not a derived clock time', async () => {
    // The timetable says 05:02, which is not 05:45 minus 40 minutes.
    const scheduled = new Date('2026-09-14T05:02:00')
    const provider = new RecordingProvider(transitEstimate(40, 10, scheduled))
    const plan = await buildPlan(call, basePrefs, provider, NOW)

    expect(formatClock(plan.leaveAt)).toBe(formatClock(scheduled))
    // The wake alarm hangs off that real departure.
    expect(formatClock(plan.wakeAt)).toBe(formatClock(new Date('2026-09-14T04:32:00')))
  })

  it('falls back to a derived departure when no schedule comes back', async () => {
    const provider = new RecordingProvider(transitEstimate(40, 10))
    const plan = await buildPlan(call, basePrefs, provider, NOW)
    expect(formatClock(plan.leaveAt)).toBe(formatClock(new Date('2026-09-14T05:05:00')))
  })

  it('treats a missed connection as the downside', async () => {
    const scheduled = new Date('2026-09-14T05:02:00')
    // Leaving 05:02 with a 40m ride arrives 05:42; a missed train adds 20m.
    const plan = await buildPlan(call, basePrefs, new RecordingProvider(
      transitEstimate(40, 20, scheduled),
    ), NOW)

    expect(formatClock(plan.worstCaseArrivalAt)).toBe(formatClock(new Date('2026-09-14T06:02:00')))
    expect(plan.couldBeLate).toBe(true)
  })

  it('clears the flag when the buffer covers the next departure', async () => {
    const scheduled = new Date('2026-09-14T05:02:00')
    // A 15m headway lands at 05:57, still inside the 06:00 call.
    const plan = await buildPlan(call, basePrefs, new RecordingProvider(
      transitEstimate(40, 15, scheduled),
    ), NOW)
    expect(plan.couldBeLate).toBe(false)
  })

  it('reads a frequent line as safer than an infrequent one', async () => {
    const scheduled = new Date('2026-09-14T05:02:00')
    const frequent = await buildPlan(call, basePrefs, new RecordingProvider(
      transitEstimate(40, 5, scheduled),
    ), NOW)
    const rare = await buildPlan(call, basePrefs, new RecordingProvider(
      transitEstimate(40, 30, scheduled),
    ), NOW)

    expect(frequent.onTimeLikelihood).toBeGreaterThan(rare.onTimeLikelihood)
  })
})

describe('one-sided spread', () => {
  it('reads the whole bracket as a single tail', () => {
    const oneSided = transitEstimate(40, 20)
    const twoSided: TravelEstimate = { ...oneSided, oneSidedSpread: false }

    // Same 20-minute width, but a timetable cannot run early, so the same
    // width means twice the deviation of a two-tailed traffic bracket.
    expect(travelSigma(oneSided)).toBeCloseTo(travelSigma(twoSided) * 2, 5)
  })

  it('makes the same buffer look riskier on transit than on a road', () => {
    const oneSided = transitEstimate(40, 20)
    const twoSided: TravelEstimate = { ...oneSided, oneSidedSpread: false }
    expect(onTimeLikelihood(oneSided, 50)).toBeLessThan(onTimeLikelihood(twoSided, 50))
  })
})

describe('MockMapsProvider transit', () => {
  const provider = new MockMapsProvider()
  const query = (mode: 'transit' | 'drive', by: Date): TravelQuery => ({
    origin: '433 Warren St, Brooklyn NY',
    destination: 'Silvercup Studios, Queens NY',
    mode,
    timing: { type: 'arrive', by },
  })

  it('returns a schedule-shaped estimate', async () => {
    const e = await provider.estimate(query('transit', new Date('2026-09-14T09:00:00')))
    expect(e.oneSidedSpread).toBe(true)
    expect(e.optimisticMinutes).toBe(e.expectedMinutes)
    expect(e.missedConnectionMinutes).toBeGreaterThan(0)
    expect(e.scheduledDepartureAt).toBeInstanceOf(Date)
  })

  it('pins the boarding time to the requested arrival', async () => {
    const by = new Date('2026-09-14T09:00:00')
    const e = await provider.estimate(query('transit', by))
    const gap = (by.getTime() - e.scheduledDepartureAt!.getTime()) / 60_000
    expect(gap).toBeCloseTo(e.expectedMinutes, 3)
  })

  it('widens the headway outside service hours', async () => {
    const midday = await provider.estimate(query('transit', new Date('2026-09-14T14:00:00')))
    const smallHours = await provider.estimate(query('transit', new Date('2026-09-14T03:00:00')))
    expect(smallHours.missedConnectionMinutes!).toBeGreaterThan(midday.missedConnectionMinutes!)
  })

  it('leaves driving two-sided', async () => {
    const e = await provider.estimate(query('drive', new Date('2026-09-14T09:00:00')))
    expect(e.oneSidedSpread).toBeUndefined()
    expect(e.optimisticMinutes).toBeLessThan(e.expectedMinutes)
  })
})
