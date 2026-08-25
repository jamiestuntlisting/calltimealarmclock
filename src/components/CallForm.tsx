import type { CallDetails, TravelMode } from '../types'
import { combineDateAndTime, formatRelativeDay } from '../lib/time'
import AddressField from './AddressField'

const MODES: Array<{ value: TravelMode; label: string }> = [
  { value: 'drive', label: 'Drive' },
  { value: 'transit', label: 'Transit' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
]

interface Props {
  call: CallDetails
  onChange: (next: CallDetails) => void
  onCalculate: () => void
  canCalculate: boolean
  busy: boolean
}

export default function CallForm({ call, onChange, onCalculate, canCalculate, busy }: Props) {
  const set = <K extends keyof CallDetails>(key: K, value: CallDetails[K]) =>
    onChange({ ...call, [key]: value })

  const setAddress = (address: string) => set('reportAddress', address)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* A button that is really the native picker, laid invisibly over its own
          label so the whole pill is the tap target. */}
      <div className="date-swap">
        <span className="date-swap-label">
          {formatRelativeDay(combineDateAndTime(call.date, '12:00'))}
        </span>
        <input
          id="call-date"
          type="date"
          aria-label="Call date"
          value={call.date}
          onChange={(e) => set('date', e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="call-time">Call time</label>
        <input
          id="call-time"
          className="input-hero"
          type="time"
          value={call.time}
          onChange={(e) => set('time', e.target.value)}
        />
      </div>

      <div>
        <AddressField
          label="Report to"
          value={call.reportAddress}
          placeholder="Parking lot, basecamp or stage"
          onChange={setAddress}
        />
      </div>

      <div className="field">
        <label>Getting there</label>
        <div className="chips">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className="chip"
              aria-pressed={call.travelMode === mode.value}
              onClick={() => set('travelMode', mode.value)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="btn-accent"
        onClick={onCalculate}
        disabled={!canCalculate || busy}
      >
        {busy ? 'Working it out…' : 'Calculate'}
      </button>
    </div>
  )
}
