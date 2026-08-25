import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPlacesProvider, newSessionToken, type PlaceSuggestion } from '../lib/places'

interface Props {
  label: string
  value: string
  placeholder?: string
  onChange: (address: string) => void
}

const SUGGEST_DEBOUNCE_MS = 220

export default function AddressField({ label, value, placeholder, onChange }: Props) {
  const provider = useMemo(() => createPlacesProvider(), [])
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const inputId = useId()

  const sessionToken = useRef(newSessionToken())
  const requestId = useRef(0)
  // Suppresses the lookup that would otherwise fire from a programmatic set.
  const skipNextLookup = useRef(false)

  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false
      return
    }
    if (!open || value.trim().length < 2) {
      setSuggestions([])
      return
    }

    const id = ++requestId.current
    const timer = setTimeout(async () => {
      try {
        const results = await provider.suggest(value, sessionToken.current)
        if (id === requestId.current) {
          setSuggestions(results)
          setHighlight(-1)
        }
      } catch {
        // Autocomplete is a convenience; typing still works without it.
        if (id === requestId.current) setSuggestions([])
      }
    }, SUGGEST_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [value, open, provider])

  const choose = (suggestion: PlaceSuggestion) => {
    skipNextLookup.current = true
    onChange(suggestion.address)
    setSuggestions([])
    setOpen(false)
    // The session ends with the pick; the next search starts a fresh one.
    sessionToken.current = newSessionToken()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (event.key === 'Enter' && highlight >= 0) {
      event.preventDefault()
      choose(suggestions[highlight])
    } else if (event.key === 'Escape') {
      setSuggestions([])
    }
  }

  return (
    <div className="field address-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        // Delayed so a tap on a suggestion lands before the list unmounts.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={`${inputId}-list`}
        aria-autocomplete="list"
      />

      {open && suggestions.length > 0 && (
        <ul className="suggestions" id={`${inputId}-list`} role="listbox">
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={i === highlight ? 'highlighted' : ''}
                // mousedown fires before blur, so the pick is not lost.
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(s)
                }}
              >
                <span className="suggestion-primary">{s.primary}</span>
                {s.secondary && <span className="suggestion-secondary">{s.secondary}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
