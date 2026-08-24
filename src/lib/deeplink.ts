import type { TravelMode } from '../types'

const GOOGLE_TRAVEL_MODE: Record<TravelMode, string> = {
  drive: 'driving',
  transit: 'transit',
  bike: 'bicycling',
  walk: 'walking',
}

/**
 * Directions from wherever the performer is standing right now to the report
 * address. Origin is left blank on purpose so Google uses live location — the
 * saved home address is for planning, not for the drive itself.
 */
export function googleMapsDirectionsUrl(destination: string, mode: TravelMode): string {
  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: GOOGLE_TRAVEL_MODE[mode],
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
