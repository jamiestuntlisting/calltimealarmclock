import type { CallDetails, Place } from '../types'
import { toDateInput } from '../lib/time'
import AddressField from './AddressField'

interface Props {
  call: CallDetails
  places: Place[]
  onChange: (next: CallDetails) => void
  /** Present only once there is a plan to collapse back to. */
  onDone?: () => void
}

function shiftDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDateInput(d)
}

export default function CallForm({ call, places, onChange, onDone }: Props) {
  const set = <K extends keyof CallDetails>(key: K, value: CallDetails[K]) =>
    onChange({ ...call, [key]: value })

  // Changing where you report invalidates the confirmation you already gave.
  const setAddress = (address: string) =>
    onChange({ ...call, reportAddress: address, addressConfirmed: false })

  const dayChips: Array<{ label: string; value: string }> = [
    { label: 'Today', value: shiftDays(0) },
    { label: 'Tomorrow', value: shiftDays(1) },
    { label: 'In 2 days', value: shiftDays(2) },
  ]

  const savedLots = places.filter((p) => p.address.trim() !== '')

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="chips">
        {dayChips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="chip"
            aria-pressed={call.date === chip.value}
            onClick={() => set('date', chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="call-date">Date</label>
          <input
            id="call-date"
            type="date"
            value={call.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="call-time">Call time</label>
          <input
            id="call-time"
            type="time"
            value={call.time}
            onChange={(e) => set('time', e.target.value)}
          />
        </div>
      </div>

      <div>
        <AddressField
          label="Report to"
          value={call.reportAddress}
          placeholder="Parking lot, basecamp or stage"
          onChange={setAddress}
        />
        {savedLots.length > 0 && (
          <div className="chips" style={{ marginTop: 2 }}>
            {savedLots.map((place) => (
              <button
                key={place.id}
                type="button"
                className="chip"
                aria-pressed={call.reportAddress === place.address}
                onClick={() => setAddress(place.address)}
              >
                {place.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="call-note">Note</label>
        <input
          id="call-note"
          type="text"
          placeholder="Gate 3, ask for transpo"
          value={call.note}
          onChange={(e) => set('note', e.target.value)}
        />
      </div>

      {onDone && (
        <button type="button" className="btn-accent" onClick={onDone}>
          Done
        </button>
      )}
    </div>
  )
}
