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

/** Drops a pin on the report address so the lot can be eyeballed before leaving. */
export function googleMapsPlaceUrl(address: string): string {
  const params = new URLSearchParams({ api: '1', query: address })
  return `https://www.google.com/maps/search/?${params.toString()}`
}
