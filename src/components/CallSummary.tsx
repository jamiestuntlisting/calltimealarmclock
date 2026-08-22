import type { CallDetails } from '../types'
import { combineDateAndTime, formatClock, formatDay } from '../lib/time'

interface Props {
  call: CallDetails
  onEdit: () => void
}

/**
 * The collapsed form. Details get entered once and then only glanced at, so
 * they compress to a line and hand the screen over to the plan.
 */
export default function CallSummary({ call, onEdit }: Props) {
  const callAt = combineDateAndTime(call.date, call.time)
  return (
    <button type="button" className="call-summary" onClick={onEdit}>
      <div className="call-summary-main">
        <span className="call-summary-time">{formatClock(callAt)}</span>
        <span className="call-summary-day">{formatDay(callAt)}</span>
      </div>
      <div className="call-summary-addr">{call.reportAddress}</div>
      <div className="call-summary-edit">Edit</div>
    </button>
  )
}
