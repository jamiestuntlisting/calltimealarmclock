import { useEffect, useMemo, useState } from 'react'
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
import type { CallDetails, Plan, Preferences } from './types'

export default function App() {
  const [prefs, setPrefs] = useState(loadPreferences)
  const [call, setCall] = useState(loadCallDetails)
  // Never computed on load. A stale plan next to edited details is a lie, and
  // every calculation is a billed round trip, so it takes a deliberate tap.
  const [plan, setPlan] = useState<Plan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  /** Any edit invalidates the plan, so the form comes back with it. */
  const editCall = (next: CallDetails) => {
    setCall(next)
    setPlan(null)
    setError(null)
  }

  const editPrefs = (next: Preferences) => {
    setPrefs(next)
    setPlan(null)
    setError(null)
  }

  const calculate = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      setPlan(await buildPlan(call, prefs, provider, new Date(), conditions))
    } catch (err) {
      setPlan(null)
      setError(err instanceof Error ? err.message : 'Could not work out the route.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>Call Time</h1>
        <button type="button" className="btn-sm btn-ghost" onClick={() => setSettingsOpen(true)}>
          Preferences
        </button>
      </div>

      {plan ? (
        <CallSummary call={call} onEdit={() => setPlan(null)} />
      ) : (
        <CallForm
          call={call}
          onChange={editCall}
          onCalculate={calculate}
          canCalculate={ready}
          busy={busy}
        />
      )}

      {error && <div className="error">{error}</div>}

      {!plan && !ready && !error && (
        <div className="empty">
          {startAddress.trim() === ''
            ? 'Set where you start from in Preferences.'
            : 'Add the address you report to.'}
        </div>
      )}

      {plan && <PlanCard plan={plan} call={call} prefs={prefs} />}

      {settingsOpen && (
        <SettingsSheet
          prefs={prefs}
          onChange={editPrefs}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
