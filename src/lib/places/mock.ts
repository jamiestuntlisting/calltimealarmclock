import type { PlaceSuggestion, PlacesProvider } from './provider'

/**
 * Enough real production addresses to make the field behave like the live one
 * without a key. Lots that are easy to confuse — Universal's Gate 2 versus
 * Gate 8 — are in here on purpose.
 */
const KNOWN_PLACES: Array<{ primary: string; secondary: string }> = [
  { primary: 'Silvercup Studios', secondary: '42-22 22nd St, Long Island City, NY 11101' },
  { primary: 'Silvercup Studios East', secondary: '53-16 35th St, Long Island City, NY 11101' },
  { primary: 'Steiner Studios', secondary: '15 Washington Ave, Brooklyn, NY 11205' },
  { primary: 'Broadway Stages', secondary: '203 Meserole Ave, Brooklyn, NY 11222' },
  { primary: 'Kaufman Astoria Studios', secondary: '34-12 36th St, Astoria, NY 11106' },
  { primary: 'Universal Studios — Gate 2', secondary: '100 Universal City Plaza, Universal City, CA 91608' },
  { primary: 'Universal Studios — Gate 8', secondary: '3900 Lankershim Blvd, Universal City, CA 91604' },
  { primary: 'Warner Bros. Studios — Gate 4', secondary: '4000 Warner Blvd, Burbank, CA 91522' },
  { primary: 'Sunset Gower Studios', secondary: '1438 N Gower St, Los Angeles, CA 90028' },
  { primary: 'Santa Clarita Studios', secondary: '25135 Anza Dr, Santa Clarita, CA 91355' },
  { primary: 'Vasquez Rocks Natural Area', secondary: '10700 Escondido Canyon Rd, Agua Dulce, CA 91390' },
  { primary: 'Griffith Park — Crystal Springs Lot', secondary: '4730 Crystal Springs Dr, Los Angeles, CA 90027' },
  { primary: 'Pinewood Studios', secondary: 'Pinewood Rd, Iver Heath, Iver SL0 0NH, UK' },
  { primary: 'Trilith Studios', secondary: '461 Sandy Creek Rd, Fayetteville, GA 30214' },
  { primary: 'Albuquerque Studios', secondary: '5650 University Blvd SE, Albuquerque, NM 87106' },
]

export class MockPlacesProvider implements PlacesProvider {
  readonly source = 'mock' as const

  async suggest(query: string): Promise<PlaceSuggestion[]> {
    const needle = query.trim().toLowerCase()
    if (needle.length < 2) return []

    return KNOWN_PLACES.filter(
      (p) =>
        p.primary.toLowerCase().includes(needle) || p.secondary.toLowerCase().includes(needle),
    )
      .slice(0, 5)
      .map((p, i) => ({
        id: `mock-${i}-${p.primary}`,
        primary: p.primary,
        secondary: p.secondary,
        address: `${p.primary}, ${p.secondary}`,
      }))
  }
}
