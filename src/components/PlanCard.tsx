import type { CallDetails, Plan, Preferences } from '../types'
import { formatClock, formatDay, formatDuration, isDifferentDay } from '../lib/time'
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from '../lib/deeplink'
import { resolveStartLabel } from '../lib/schedule'

interface Props {
  plan: Plan
  call: CallDetails
  prefs: Preferences
  onConfirmAddress: () => void
}

type Tone = 'good' | 'warn' | 'bad'

function toneFor(plan: Plan, prefs: Preferences): Tone {
  if (plan.onTimeLikelihood < prefs.onTimeThreshold) return 'bad'
  return plan.couldBeLate ? 'warn' : 'good'
}

function verdictText(plan: Plan, tone: Tone): { headline: string; detail: string } {
  const worst = formatClock(plan.worstCaseArrivalAt)
  if (tone === 'bad') {
    return {
      headline: 'Leave earlier than this.',
      detail: `Bad traffic puts you at the lot at ${worst}.`,
    }
  }
  if (tone === 'warn') {
    return {
      headline: 'Late is possible.',
      detail: `Bad traffic puts you at the lot at ${worst}.`,
    }
  }
  return {
    headline: 'Buffer holds.',
    detail: `Even bad traffic gets you there by ${worst}.`,
  }
}

export default function PlanCard({ plan, call, prefs, onConfirmAddress }: Props) {
  const tone = toneFor(plan, prefs)
  const verdict = verdictText(plan, tone)
  const wakeIsPreviousDay = isDifferentDay(plan.wakeAt, plan.callAt)

  return (
    <div className="plan">
      <div className="hero">
        <div className="hero-label">Alarm</div>
        <div className="hero-time">{formatClock(plan.wakeAt)}</div>
        <div className="hero-day">
          {formatDay(plan.wakeAt)}
          {wakeIsPreviousDay && ' — night before'}
        </div>
      </div>

      <div className="card timeline">
        <div className="step">
          <div className="step-name">
            <strong>Leave</strong>
            <span className="step-sub">{resolveStartLabel(prefs)}</span>
          </div>
          <div className="step-time">{formatClock(plan.leaveAt)}</div>
        </div>
        <div className="step">
          <div className="step-name">
            <strong>Travel</strong>
            <span className="step-sub">
              {formatDuration(plan.travel.optimisticMinutes)}–{formatDuration(plan.travel.pessimisticMinutes)}
            </span>
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

      <div className={`addr-confirm ${call.addressConfirmed ? 'done' : ''}`}>
        <div style={{ flex: 1 }}>
          {call.addressConfirmed ? (
            <>Reporting to {call.reportAddress}</>
          ) : (
            <>Right lot? {call.reportAddress}</>
          )}
        </div>
        {!call.addressConfirmed && (
          <button type="button" className="btn-sm" onClick={onConfirmAddress}>
            Yes
          </button>
        )}
      </div>

      <div className="actions">
        <a
          className="btn-accent"
          style={{ textDecoration: 'none', textAlign: 'center', padding: '11px 14px', borderRadius: 10 }}
          href={googleMapsDirectionsUrl(call.reportAddress, prefs.travelMode)}
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
        <div className="mock-banner">Estimated traffic — no Maps key configured</div>
      )}
    </div>
  )
}
