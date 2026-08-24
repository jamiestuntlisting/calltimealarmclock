import type { CallDetails, Plan, Preferences, TravelEstimate } from '../types'
import type { MapsProvider } from './maps'
import { onTimeLikelihood } from './risk'
import { addMinutes, combineDateAndTime, minutesBetween } from './time'

/**
 * Traffic depends on when you leave, but when you leave depends on the traffic.
 * Two refinement passes settle that loop — a third never moves the answer by
 * enough to matter on a clock face.
 */
const REFINEMENT_PASSES = 2
const INITIAL_TRAVEL_GUESS_MINUTES = 30

export async function buildPlan(
  call: CallDetails,
  prefs: Preferences,
  provider: MapsProvider,
  now: Date = new Date(),
): Promise<Plan> {
  const callAt = combineDateAndTime(call.date, call.time)
  const targetArrivalAt = addMinutes(callAt, -prefs.arriveEarlyMinutes)

  const travel =
    prefs.travelMode === 'transit'
      ? await estimateByArrival(call, prefs, provider, targetArrivalAt)
      : await estimateByDeparture(call, prefs, provider, targetArrivalAt)

  // Transit hands back a real timetable departure; everything else derives one.
  const leaveAt =
    travel.scheduledDepartureAt ?? addMinutes(targetArrivalAt, -travel.expectedMinutes)

  const wakeAt = addMinutes(leaveAt, -prefs.getReadyMinutes)
  const worstCaseArrivalAt = addMinutes(leaveAt, travel.pessimisticMinutes)

  // The budget runs from leaving to the call itself, so it already absorbs
  // the early buffer — being "late" means missing call, not missing the buffer.
  const budgetMinutes = minutesBetween(leaveAt, callAt)

  return {
    callAt,
    targetArrivalAt,
    leaveAt,
    wakeAt,
    travel,
    worstCaseArrivalAt,
    onTimeLikelihood: onTimeLikelihood(travel, budgetMinutes),
    couldBeLate: worstCaseArrivalAt.getTime() > callAt.getTime(),
    wakeTimeHasPassed: wakeAt.getTime() < now.getTime(),
  }
}

/**
 * Transit runs on a timetable, so it answers the question directly: what gets
 * me there by this time? No iteration — the schedule already knows.
 */
async function estimateByArrival(
  call: CallDetails,
  prefs: Preferences,
  provider: MapsProvider,
  targetArrivalAt: Date,
): Promise<TravelEstimate> {
  return provider.estimate({
    origin: resolveStartAddress(prefs),
    destination: call.reportAddress,
    mode: prefs.travelMode,
    timing: { type: 'arrive', by: targetArrivalAt },
  })
}

/** Driving, cycling and walking are solved forwards from a departure time. */
async function estimateByDeparture(
  call: CallDetails,
  prefs: Preferences,
  provider: MapsProvider,
  targetArrivalAt: Date,
): Promise<TravelEstimate> {
  const query = (departAt: Date) => ({
    origin: resolveStartAddress(prefs),
    destination: call.reportAddress,
    mode: prefs.travelMode,
    timing: { type: 'depart' as const, at: departAt },
  })

  let travel = await provider.estimate(
    query(addMinutes(targetArrivalAt, -INITIAL_TRAVEL_GUESS_MINUTES)),
  )

  for (let pass = 0; pass < REFINEMENT_PASSES; pass++) {
    travel = await provider.estimate(
      query(addMinutes(targetArrivalAt, -travel.expectedMinutes)),
    )
  }

  return travel
}

export function resolveStartAddress(prefs: Preferences): string {
  const place = prefs.places.find((p) => p.id === prefs.startPlaceId) ?? prefs.places[0]
  return place?.address ?? ''
}

export function resolveStartLabel(prefs: Preferences): string {
  const place = prefs.places.find((p) => p.id === prefs.startPlaceId) ?? prefs.places[0]
  return place?.label ?? 'Start'
}
