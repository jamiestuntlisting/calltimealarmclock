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
  const origin = resolveStartAddress(prefs)
  const callAt = combineDateAndTime(call.date, call.time)
  const targetArrivalAt = addMinutes(callAt, -prefs.arriveEarlyMinutes)

  let departAt = addMinutes(targetArrivalAt, -INITIAL_TRAVEL_GUESS_MINUTES)
  let travel: TravelEstimate = await provider.estimate({
    origin,
    destination: call.reportAddress,
    mode: prefs.travelMode,
    departAt,
  })

  for (let pass = 0; pass < REFINEMENT_PASSES; pass++) {
    departAt = addMinutes(targetArrivalAt, -travel.expectedMinutes)
    travel = await provider.estimate({
      origin,
      destination: call.reportAddress,
      mode: prefs.travelMode,
      departAt,
    })
  }

  const leaveAt = addMinutes(targetArrivalAt, -travel.expectedMinutes)
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

export function resolveStartAddress(prefs: Preferences): string {
  const place = prefs.places.find((p) => p.id === prefs.startPlaceId) ?? prefs.places[0]
  return place?.address ?? ''
}

export function resolveStartLabel(prefs: Preferences): string {
  const place = prefs.places.find((p) => p.id === prefs.startPlaceId) ?? prefs.places[0]
  return place?.label ?? 'Start'
}
