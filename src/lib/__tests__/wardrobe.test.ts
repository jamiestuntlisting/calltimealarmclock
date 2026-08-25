import { describe, expect, it } from 'vitest'
import { recommendWardrobe } from '../wardrobe'
import type { Conditions } from '../../types'

const point = (temperatureF: number, precipitationChance = 0): Conditions => ({
  at: new Date('2026-09-14T06:00:00'),
  temperatureF,
  summary: '',
  precipitationChance,
})

const items = (temps: number[], pref: 'cold' | 'average' | 'warm' = 'average', rain = 0) =>
  recommendWardrobe(temps.map((t) => point(t, rain)), pref).items

describe('recommendWardrobe', () => {
  it('dresses for the coldest point, not the average', () => {
    // A 30° dawn and an 80° afternoon still means thermals in the bag.
    expect(items([30, 80, 70])).toContain('Thermals')
  })

  it('scales from thermals to shorts', () => {
    expect(items([20, 20, 20])).toContain('Puffer jacket')
    expect(items([50, 50, 50])).toContain('Light jacket')
    expect(items([85, 85, 85])).toContain('Shorts')
  })

  it('adds rain gear once rain is likely', () => {
    expect(items([60, 60, 60], 'average', 10)).not.toContain('Rain jacket')
    expect(items([60, 60, 60], 'average', 50)).toContain('Rain jacket')
    expect(items([60, 60, 60], 'average', 50)).toContain('Waterproof shoes')
  })

  it('only reaches for rain pants when it is really coming down', () => {
    expect(items([60, 60, 60], 'average', 50)).not.toContain('Rain pants')
    expect(items([60, 60, 60], 'average', 80)).toContain('Rain pants')
  })

  it('uses the wettest point of the day, not the first', () => {
    const result = recommendWardrobe(
      [point(60, 0), point(60, 0), point(60, 70)],
      'average',
    )
    expect(result.items).toContain('Rain jacket')
  })

  it('dresses someone who runs cold for colder weather than the thermometer', () => {
    // 58° reads as 50° to them, which crosses into needing long pants.
    expect(items([58, 58, 58], 'cold')).toContain('Long pants')
    expect(items([58, 58, 58], 'average')).not.toContain('Long pants')
  })

  it('dresses someone who runs warm more lightly', () => {
    expect(items([70, 70, 70], 'warm')).toContain('Shorts')
    expect(items([70, 70, 70], 'average')).toContain('Long pants')
  })

  it('calls out a swing worth layering for', () => {
    expect(recommendWardrobe([point(40), point(65), point(58)], 'average').swingNote)
      .toMatch(/25° swing/)
  })

  it('stays quiet when the day is steady', () => {
    expect(recommendWardrobe([point(60), point(64), point(62)], 'average').swingNote)
      .toBeUndefined()
  })

  it('returns nothing for no data rather than guessing', () => {
    expect(recommendWardrobe([], 'average').items).toEqual([])
  })
})
