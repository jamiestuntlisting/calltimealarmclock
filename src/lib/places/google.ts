import type { PlaceSuggestion, PlacesProvider } from './provider'

const AUTOCOMPLETE_ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete'

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string
      text?: { text?: string }
      structuredFormat?: {
        mainText?: { text?: string }
        secondaryText?: { text?: string }
      }
    }
  }>
}

export class GooglePlacesProvider implements PlacesProvider {
  readonly source = 'google' as const

  constructor(private readonly apiKey: string) {}

  async suggest(query: string, sessionToken: string): Promise<PlaceSuggestion[]> {
    if (query.trim().length < 3) return []

    const response = await fetch(AUTOCOMPLETE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
      },
      // The session token groups these keystrokes into one billable session.
      body: JSON.stringify({ input: query, sessionToken }),
    })

    if (!response.ok) {
      // A dead autocomplete must not block typing — the field stays free text.
      return []
    }

    const data = (await response.json()) as AutocompleteResponse

    return (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p, i) => {
        const full = p.text?.text ?? ''
        const primary = p.structuredFormat?.mainText?.text ?? full
        const secondary = p.structuredFormat?.secondaryText?.text ?? ''
        return {
          id: p.placeId ?? `google-${i}-${primary}`,
          primary,
          secondary,
          address: full || [primary, secondary].filter(Boolean).join(', '),
        }
      })
  }
}
