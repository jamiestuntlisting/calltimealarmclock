import type { Preferences } from '../types'
import AddressField from './AddressField'

interface Props {
  prefs: Preferences
  onChange: (next: Preferences) => void
  onClose: () => void
}

function Stepper({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  step: number
  min: number
  max: number
  onChange: (next: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="field">
      <label>{label}</label>
      <div className="stepper">
        <button type="button" onClick={() => onChange(clamp(value - step))} aria-label={`Less ${label}`}>
          −
        </button>
        <div className="value">{value}m</div>
        <button type="button" onClick={() => onChange(clamp(value + step))} aria-label={`More ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}

export default function SettingsSheet({ prefs, onChange, onClose }: Props) {
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    onChange({ ...prefs, [key]: value })

  const startPlace = prefs.places.find((p) => p.id === prefs.startPlaceId) ?? prefs.places[0]

  const setStartAddress = (address: string) =>
    onChange({
      ...prefs,
      places: prefs.places.map((p) => (p.id === startPlace.id ? { ...p, address } : p)),
    })

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Preferences</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>

        <AddressField
          label="Start from"
          value={startPlace?.address ?? ''}
          placeholder="Your home address"
          onChange={setStartAddress}
        />

        <Stepper
          label="Time to get ready"
          value={prefs.getReadyMinutes}
          step={5}
          min={0}
          max={240}
          onChange={(v) => set('getReadyMinutes', v)}
        />

        <Stepper
          label="Arrive early by"
          value={prefs.arriveEarlyMinutes}
          step={5}
          min={0}
          max={120}
          onChange={(v) => set('arriveEarlyMinutes', v)}
        />

        <div className="field">
          <label htmlFor="threshold">Flag below</label>
          <select
            id="threshold"
            value={prefs.onTimeThreshold}
            onChange={(e) => set('onTimeThreshold', Number(e.target.value))}
          >
            <option value={0.75}>75% on time</option>
            <option value={0.85}>85% on time</option>
            <option value={0.9}>90% on time</option>
            <option value={0.95}>95% on time</option>
          </select>
        </div>
      </div>
    </div>
  )
}
