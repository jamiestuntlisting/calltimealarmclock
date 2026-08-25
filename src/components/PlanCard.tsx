import type { CallDetails, Plan, Preferences } from '../types'
import { formatClock, formatDay, formatDuration, isDifferentDay } from '../lib/time'
import { googleMapsDirectionsUrl } from '../lib/deeplink'
import { resolveStartLabel } from '../lib/schedule'

interface Props {
  plan: Plan
  call: CallDetails
  prefs: Preferences
}

type Tone = 'good' | 'warn' | 'bad'

function toneFor(plan: Plan, prefs: Preferences): Tone {
  if (plan.onTimeLikelihood < prefs.onTimeThreshold) return 'bad'
  return plan.couldBeLate ? 'warn' : 'good'
}

function verdictText(plan: Plan, tone: Tone): { headline: string; detail: string } {
  const worst = formatClock(plan.worstCaseArrivalAt)
  // On transit the downside is a missed connection, not traffic — and saying
  // "traffic" to someone about to board a train reads as a bug.
  const cause = plan.travel.missedConnectionMinutes ? 'Miss your connection and' : 'Bad traffic'
  const verb = plan.travel.missedConnectionMinutes ? "you're at the lot" : 'puts you at the lot'

  if (tone === 'bad') {
    return { headline: 'Leave earlier than this.', detail: `${cause} ${verb} at ${worst}.` }
  }
  if (tone === 'warn') {
    return { headline: 'Late is possible.', detail: `${cause} ${verb} at ${worst}.` }
  }
  return {
    headline: 'Buffer holds.',
    detail: plan.travel.missedConnectionMinutes
      ? `Even a missed connection gets you there by ${worst}.`
      : `Even bad traffic gets you there by ${worst}.`,
  }
}

/** How the travelling gap is described, which depends on how you travel. */
function travelWord(plan: Plan): string {
  if (plan.travel.scheduledDepartureAt || plan.travel.missedConnectionMinutes) return 'on transit'
  return 'travelling'
}

/** The spread beside the expected duration, which differs by mode. */
function travelDetail(plan: Plan): string {
  const { missedConnectionMinutes, transitLegs, optimisticMinutes, pessimisticMinutes } = plan.travel
  if (missedConnectionMinutes) {
    const next = `next in ${formatDuration(missedConnectionMinutes)}`
    return transitLegs && transitLegs > 1 ? `${transitLegs} legs — ${next}` : next
  }
  const low = formatDuration(optimisticMinutes)
  const high = formatDuration(pessimisticMinutes)
  // A range whose ends round together says nothing — 4am has no traffic.
  return low === high ? '' : `${low}–${high}`
}

export default function PlanCard({ plan, call, prefs }: Props) {
  const tone = toneFor(plan, prefs)
  const verdict = verdictText(plan, tone)
  const wakeIsPreviousDay = isDifferentDay(plan.wakeAt, plan.callAt)
  const leaveIsPreviousDay = isDifferentDay(plan.leaveAt, plan.callAt)

  return (
    <div className="plan">
      {/* One chain, read top to bottom: the two alarms you act on, then what
          follows from them, with each gap labelled by what fills it. */}
      <div className="chain">
        <div className="moment alarm">
          <div className="moment-row">
            <div className="moment-label">Wake up</div>
            <div className="moment-time">{formatClock(plan.wakeAt)}</div>
          </div>
          <div className="moment-sub">
            {wakeIsPreviousDay ? `${formatDay(plan.wakeAt)} — night before` : formatDay(plan.wakeAt)}
          </div>
        </div>

        <div className="gap">{formatDuration(prefs.getReadyMinutes)} to get ready</div>

        <div className="moment alarm">
          <div className="moment-row">
            <div className="moment-label">Leave</div>
            <div className="moment-time">{formatClock(plan.leaveAt)}</div>
          </div>
          <div className="moment-sub">
            {leaveIsPreviousDay
              ? `${formatDay(plan.leaveAt)} — night before`
              : plan.travel.scheduledDepartureAt
                ? 'scheduled departure'
                : `from ${resolveStartLabel(prefs)}`}
          </div>
        </div>

        <div className="gap">
          {formatDuration(plan.travel.expectedMinutes)} {travelWord(plan)}
          {travelDetail(plan) && <span className="gap-range"> · {travelDetail(plan)}</span>}
        </div>

        <div className="moment">
          <div className="moment-row">
            <div className="moment-label">Arrive</div>
            <div className="moment-time">{formatClock(plan.targetArrivalAt)}</div>
          </div>
        </div>

        <div className="gap">{formatDuration(prefs.arriveEarlyMinutes)} early</div>

        <div className="moment">
          <div className="moment-row">
            <div className="moment-label">Call</div>
            <div className="moment-time">{formatClock(plan.callAt)}</div>
          </div>
        </div>
      </div>

      {plan.conditions && (
        <div className="conditions">
          <div className="conditions-main">
            <span className="conditions-temp">{plan.conditions.temperatureF}°</span>
            <span className="conditions-summary">{plan.conditions.summary}</span>
            {plan.conditions.precipitationChance >= 20 && (
              <span className="conditions-rain">{plan.conditions.precipitationChance}% rain</span>
            )}
          </div>
          {plan.conditions.pollen && (
            <div className={`pollen pollen-${Math.min(5, plan.conditions.pollen.index)}`}>
              {plan.conditions.pollen.type} pollen · {plan.conditions.pollen.category}
            </div>
          )}
        </div>
      )}

      <div className={`verdict ${tone}`}>
        <div className="verdict-pct">{Math.round(plan.onTimeLikelihood * 100)}%</div>
        <div className="verdict-text">
          {verdict.headline}
          <small>{verdict.detail}</small>
        </div>
      </div>

      {plan.wakeTimeHasPassed && (
        <div className="error">That alarm time has already passed.</div>
      )}

      <a
        className="btn-accent action-link"
        href={googleMapsDirectionsUrl(call.reportAddress, call.travelMode)}
        target="_blank"
        rel="noreferrer"
      >
        Get directions
      </a>

      {plan.travel.source === 'mock' && (
        <div className="mock-banner">Estimated times — no Maps key configured</div>
      )}
    </div>
  )
}
