import { useEffect, useMemo, useRef, useState } from 'react'
import CallForm from './components/CallForm'
import CallSummary from './components/CallSummary'
import PlanCard from './components/PlanCard'
import SettingsSheet from './components/SettingsSheet'
import { createConditionsProvider } from './lib/conditions'
import { createMapsProvider } from './lib/maps'
import { buildPlan, resolveStartAddress } from './lib/schedule'
import {
  loadCallDetails,
  loadPreferences,
  saveCallDetails,
  savePreferences,
} from './lib/storage'
import type { Plan } from './types'

/** Address edits arrive a keystroke at a time; wait for a pause before routing. */
const LOOKUP_DEBOUNCE_MS = 450

export default function App() {
  const [prefs, setPrefs] = useState(loadPreferences)
  const [call, setCall] = useState(loadCallDetails)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Open on a first run so the details get filled in; collapsed on a return
  // visit, where the saved call is already good and the plan is the point.
  const [editingCall, setEditingCall] = useState(() => call.reportAddress.trim() === '')

  const provider = useMemo(() => createMapsProvider(), [])
  const conditions = useMemo(() => createConditionsProvider(), [])
  const startAddress = resolveStartAddress(prefs)
  const ready = startAddress.trim() !== '' && call.reportAddress.trim() !== ''

  useEffect(() => savePreferences(prefs), [prefs])
  useEffect(() => saveCallDetails(call), [call])

  // Open settings on first run so the start address gets filled in.
  useEffect(() => {
    if (startAddress.trim() === '') setSettingsOpen(true)
    // Intentionally first-run only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const requestId = useRef(0)

  useEffect(() => {
    if (!ready) {
      setPlan(null)
      setError(null)
      return
    }

    const id = ++requestId.current
    const timer = setTimeout(async () => {
      try {
        const next = await buildPlan(call, prefs, provider, new Date(), conditions)
        // A newer lookup started while this one was in flight.
        if (id === requestId.current) {
          setPlan(next)
          setError(null)
        }
      } catch (err) {
        if (id === requestId.current) {
          setPlan(null)
          setError(err instanceof Error ? err.message : 'Could not work out the route.')
        }
      }
    }, LOOKUP_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [call, prefs, provider, conditions, ready])

  return (
    <div className="app">
      <div className="topbar">
        <h1>Call Time</h1>
        <button type="button" className="btn-sm btn-ghost" onClick={() => setSettingsOpen(true)}>
          Preferences
        </button>
      </div>

      {plan && !editingCall ? (
        <CallSummary call={call} onEdit={() => setEditingCall(true)} />
      ) : (
        <CallForm
          call={call}
          onChange={setCall}
          onDone={plan ? () => setEditingCall(false) : undefined}
        />
      )}

      {error && <div className="error">{error}</div>}

      {!ready && !error && (
        <div className="empty">
          {startAddress.trim() === ''
            ? 'Set where you start from in Preferences.'
            : 'Add the address you report to.'}
        </div>
      )}

      {ready && !plan && !error && <div className="empty">Working out the commute…</div>}

      {plan && (
        <PlanCard plan={plan} call={call} prefs={prefs} />
      )}

      {settingsOpen && (
        <SettingsSheet
          prefs={prefs}
          onChange={setPrefs}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
