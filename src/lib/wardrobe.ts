import type { Conditions, ThermalPreference } from '../types'

/**
 * How many degrees to shift the felt temperature. Someone who runs cold is
 * dressed for weather colder than the thermometer says.
 */
const THERMAL_OFFSET_F: Record<ThermalPreference, number> = {
  cold: -8,
  average: 0,
  warm: 8,
}

/** Above this chance, rain is worth carrying gear for. */
const RAIN_LIKELY = 40
/** Above this, it is worth the trousers too. */
const RAIN_HEAVY = 60
/** A swing this wide means layers you can shed, not one right answer. */
const NOTABLE_SWING_F = 15
/** Wind past this changes what you take, not just how it feels. */
const WINDY_MPH = 20
/** Past this, sun is the thing to dress against. */
const STRONG_SUN_F = 85

/**
 * Bands run coldest first; the first match wins. Calibrated for someone
 * standing outdoors, not for someone sprinting between buildings — but a
 * jacket does not appear until it is genuinely jacket weather.
 */
const BANDS: Array<{ maxF: number; items: string[] }> = [
  { maxF: 25, items: ['Thermals', 'Puffer jacket', 'Hat', 'Gloves', 'Insulated boots'] },
  { maxF: 35, items: ['Thermals', 'Puffer jacket', 'Hat', 'Gloves'] },
  { maxF: 45, items: ['Warm jacket', 'Long pants', 'Hat'] },
  { maxF: 55, items: ['Light jacket', 'Long pants'] },
  { maxF: 68, items: ['Long sleeves', 'Long pants'] },
  { maxF: 78, items: ['T-shirt', 'Long pants'] },
  { maxF: Infinity, items: ['T-shirt', 'Shorts'] },
]

function bandFor(feelsF: number): string[] {
  return BANDS.find((b) => feelsF <= b.maxF)!.items
}

/**
 * What to wear for a whole shoot day. Driven by the coldest point — you can
 * always take a layer off, but you cannot put on what you left at home — and
 * by how it feels rather than what the thermometer reads, so a windy 45
 * dresses like the 38 it actually is.
 */
export function recommendWardrobe(
  points: Conditions[],
  preference: ThermalPreference,
): { items: string[]; swingNote?: string; windNote?: string } {
  if (points.length === 0) return { items: [] }

  const offset = THERMAL_OFFSET_F[preference]
  const feels = points.map((p) => p.feelsLikeF + offset)
  const coldest = Math.min(...feels)
  const warmest = Math.max(...feels)

  const items = [...bandFor(coldest)]

  const wettest = Math.max(...points.map((p) => p.precipitationChance))
  if (wettest >= RAIN_LIKELY) {
    items.push('Rain jacket', 'Waterproof shoes')
    if (wettest >= RAIN_HEAVY) items.push('Rain pants')
  }

  const windiest = Math.max(...points.map((p) => p.windMph))
  // A windbreaker only helps if there is not already a coat in the list.
  if (windiest >= WINDY_MPH && coldest > 55 && !items.some((i) => i.includes('jacket'))) {
    items.push('Windbreaker')
  }

  if (warmest >= STRONG_SUN_F && !items.includes('Hat')) items.push('Sun hat')

  const swing = Math.round(warmest - coldest)
  return {
    items,
    swingNote: swing >= NOTABLE_SWING_F ? `${swing}° swing — dress in layers` : undefined,
    windNote: windiest >= WINDY_MPH ? `${Math.round(windiest)} mph wind` : undefined,
  }
}

/**
 * NWS wind chill, for when the provider does not hand back an apparent
 * temperature. Only defined below 50°F and above 3 mph; outside that the
 * dry-bulb reading is what it feels like.
 */
export function windChillF(temperatureF: number, windMph: number): number {
  if (temperatureF > 50 || windMph < 3) return temperatureF
  const v = Math.pow(windMph, 0.16)
  return 35.74 + 0.6215 * temperatureF - 35.75 * v + 0.4275 * temperatureF * v
}
