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

/** Bands run coldest first; the first match wins. */
const BANDS: Array<{ maxF: number; items: string[] }> = [
  { maxF: 25, items: ['Thermals', 'Puffer jacket', 'Hat', 'Gloves', 'Insulated boots'] },
  { maxF: 35, items: ['Thermals', 'Puffer jacket', 'Hat', 'Gloves'] },
  { maxF: 45, items: ['Thermals', 'Warm jacket', 'Hat'] },
  { maxF: 55, items: ['Long sleeves', 'Light jacket', 'Long pants'] },
  { maxF: 65, items: ['Long sleeves', 'Light jacket'] },
  { maxF: 75, items: ['T-shirt', 'Long pants'] },
  { maxF: Infinity, items: ['T-shirt', 'Shorts'] },
]

function bandFor(feelsF: number): string[] {
  return BANDS.find((b) => feelsF <= b.maxF)!.items
}

/**
 * What to wear for a whole shoot day. Dressing is driven by the coldest point
 * — you can always take a layer off, but you cannot put on what you left at
 * home — with rain gear added on top of whatever the temperature calls for.
 */
export function recommendWardrobe(
  points: Conditions[],
  preference: ThermalPreference,
): { items: string[]; swingNote?: string } {
  if (points.length === 0) return { items: [] }

  const offset = THERMAL_OFFSET_F[preference]
  const temps = points.map((p) => p.temperatureF + offset)
  const coldest = Math.min(...temps)
  const warmest = Math.max(...temps)

  const items = [...bandFor(coldest)]

  const wettest = Math.max(...points.map((p) => p.precipitationChance))
  if (wettest >= RAIN_LIKELY) {
    items.push('Rain jacket', 'Waterproof shoes')
    if (wettest >= RAIN_HEAVY) items.push('Rain pants')
  }

  const swing = Math.round(warmest - coldest)
  return {
    items,
    swingNote: swing >= NOTABLE_SWING_F ? `${swing}° swing — dress in layers` : undefined,
  }
}
