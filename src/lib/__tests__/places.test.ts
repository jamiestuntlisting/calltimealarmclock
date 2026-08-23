import { describe, expect, it } from 'vitest'
import { MockPlacesProvider } from '../places/mock'

const provider = new MockPlacesProvider()

describe('MockPlacesProvider', () => {
  it('stays quiet until there is enough to match on', async () => {
    expect(await provider.suggest('S')).toEqual([])
    expect(await provider.suggest('  ')).toEqual([])
  })

  it('matches on the place name', async () => {
    const results = await provider.suggest('silvercup')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].primary).toContain('Silvercup')
  })

  it('matches on the street line too', async () => {
    const results = await provider.suggest('Burbank')
    expect(results.some((r) => r.primary.includes('Warner'))).toBe(true)
  })

  it('separates the lots that are easiest to confuse', async () => {
    const results = await provider.suggest('Universal Studios')
    const names = results.map((r) => r.primary)
    expect(names).toContain('Universal Studios — Gate 2')
    expect(names).toContain('Universal Studios — Gate 8')
    // Same name, different lot, different address — the whole point of the field.
    const addresses = new Set(results.map((r) => r.address))
    expect(addresses.size).toBe(results.length)
  })

  it('returns a full address ready to route on', async () => {
    const [first] = await provider.suggest('Steiner')
    expect(first.address).toBe('Steiner Studios, 15 Washington Ave, Brooklyn, NY 11205')
  })

  it('caps the list so it does not swamp the form', async () => {
    const results = await provider.suggest('studios')
    expect(results.length).toBeLessThanOrEqual(5)
  })

  it('is case insensitive', async () => {
    expect((await provider.suggest('VASQUEZ')).length).toBeGreaterThan(0)
  })

  it('gives every row a distinct id for keying', async () => {
    const results = await provider.suggest('studios')
    expect(new Set(results.map((r) => r.id)).size).toBe(results.length)
  })
})
