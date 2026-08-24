import { describe, expect, it, vi, afterEach } from 'vitest'
import { GoogleMapsProvider } from '../maps/google'
import type { TravelQuery } from '../../types'

const query: TravelQuery = {
  origin: '433 Warren St',
  destination: 'Base Camp Lot B',
  mode: 'walk',
  timing: { type: 'depart', at: new Date(Date.now() + 3_600_000) },
}

const respondWith = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))

afterEach(() => vi.unstubAllGlobals())

describe('Routes API failures', () => {
  it('relays the reason Google gives rather than only the status', async () => {
    respondWith(403, {
      error: { code: 403, status: 'PERMISSION_DENIED', message: 'Requests from referer <empty> are blocked.' },
    })
    await expect(new GoogleMapsProvider('k').estimate(query)).rejects.toThrow(
      /Requests from referer <empty> are blocked/,
    )
  })

  it('names the API so the message says where to look', async () => {
    respondWith(403, { error: { message: 'This API method requires billing to be enabled.' } })
    await expect(new GoogleMapsProvider('k').estimate(query)).rejects.toThrow(/Google Routes API/)
  })

  it('falls back to the status code when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    await expect(new GoogleMapsProvider('k').estimate(query)).rejects.toThrow(/returned 502/)
  })
})
