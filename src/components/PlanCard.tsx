import type { CallDetails, Plan, Preferences } from '../types'
import { formatClock, formatDay, formatDuration, isDifferentDay } from '../lib/time'
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from '../lib/deeplink'
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

/** What the Travel row shows under its heading, which differs by mode. */
function travelDetail(plan: Plan): string {
  const { missedConnectionMinutes, transitLegs, optimisticMinutes, pessimisticMinutes } = plan.travel
  if (missedConnectionMinutes) {
    const next = `next in ${formatDuration(missedConnectionMinutes)}`
    return transitLegs && transitLegs > 1 ? `${transitLegs} legs — ${next}` : next
  }
  return `${formatDuration(optimisticMinutes)}–${formatDuration(pessimisticMinutes)}`
}

export default function PlanCard({ plan, call, prefs }: Props) {
  const tone = toneFor(plan, prefs)
  const verdict = verdictText(plan, tone)
  const wakeIsPreviousDay = isDifferentDay(plan.wakeAt, plan.callAt)
  const leaveIsPreviousDay = isDifferentDay(plan.leaveAt, plan.callAt)

  return (
    <div className="plan">
      <div className="alarms">
        <div className="alarm">
          <div className="hero-label">Wake up</div>
          <div className="hero-time">{formatClock(plan.wakeAt)}</div>
          <div className="hero-day">
            {wakeIsPreviousDay ? `${formatDay(plan.wakeAt)} — night before` : formatDay(plan.wakeAt)}
          </div>
        </div>
        <div className="alarm">
          <div className="hero-label">Leave</div>
          <div className="hero-time">{formatClock(plan.leaveAt)}</div>
          <div className="hero-day">
            {leaveIsPreviousDay
              ? `${formatDay(plan.leaveAt)} — night before`
              : plan.travel.scheduledDepartureAt
                ? 'scheduled departure'
                : `from ${resolveStartLabel(prefs)}`}
          </div>
        </div>
      </div>

      <div className="card timeline">
        <div className="step">
          <div className="step-name">
            <strong>Get ready</strong>
          </div>
          <div className="step-time">{formatDuration(prefs.getReadyMinutes)}</div>
        </div>
        <div className="step">
          <div className="step-name">
            <strong>Travel</strong>
            <span className="step-sub">{travelDetail(plan)}</span>
          </div>
          <div className="step-time">{formatDuration(plan.travel.expectedMinutes)}</div>
        </div>
        <div className="step">
          <div className="step-name">
            <strong>Arrive</strong>
            <span className="step-sub">{prefs.arriveEarlyMinutes}m early</span>
          </div>
          <div className="step-time">{formatClock(plan.targetArrivalAt)}</div>
        </div>
        <div className="step">
          <div className="step-name">
            <strong>Call</strong>
            {call.note.trim() && <span className="step-sub">{call.note.trim()}</span>}
          </div>
          <div className="step-time">{formatClock(plan.callAt)}</div>
        </div>
      </div>

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

      <div className="actions">
        <a
          className="btn-accent"
          style={{ textDecoration: 'none', textAlign: 'center', padding: '11px 14px', borderRadius: 10 }}
          href={googleMapsDirectionsUrl(call.reportAddress, call.travelMode)}
          target="_blank"
          rel="noreferrer"
        >
          Directions
        </a>
        <a
          className="btn-ghost"
          style={{
            textDecoration: 'none',
            textAlign: 'center',
            padding: '11px 14px',
            borderRadius: 10,
            border: '1px solid var(--line)',
            color: 'var(--text)',
          }}
          href={googleMapsPlaceUrl(call.reportAddress)}
          target="_blank"
          rel="noreferrer"
        >
          See the lot
        </a>
      </div>

      {plan.travel.source === 'mock' && (
        <div className="mock-banner">Estimated times — no Maps key configured</div>
      )}
    </div>
  )
}
