/** One address suggestion, split so the list can show a strong primary line. */
export interface PlaceSuggestion {
  id: string
  /** The name or street line — "Silvercup Studios". */
  primary: string
  /** The disambiguating rest — "42-22 22nd St, Long Island City, NY". */
  secondary: string
  /** What goes into the address field when this row is picked. */
  address: string
}

export interface PlacesProvider {
  readonly source: 'google' | 'mock'
  /**
   * `sessionToken` groups keystrokes into one billable autocomplete session.
   * Providers that do not bill per session ignore it.
   */
  suggest(query: string, sessionToken: string): Promise<PlaceSuggestion[]>
}
