import { describe, expect, it } from 'vitest'
import { recommendWardrobe, windChillF } from '../wardrobe'
import type { Conditions, ThermalPreference } from '../../types'

const point = (
  feelsLikeF: number,
  { rain = 0, wind = 0, temp = feelsLikeF } = {},
): Conditions => ({
  at: new Date('2026-09-14T06:00:00'),
  temperatureF: temp,
  feelsLikeF,
  windMph: wind,
  summary: '',
  precipitationChance: rain,
})

const items = (
  temps: number[],
  pref: ThermalPreference = 'average',
  opts: { rain?: number; wind?: number } = {},
) => recommendWardrobe(temps.map((t) => point(t, opts)), pref).items

describe('recommendWardrobe', () => {
  it('does not put a jacket on a mild day', () => {
    // 65° is long sleeves weather, not jacket weather.
    expect(items([65, 65, 65])).toEqual(['Long sleeves', 'Long pants'])
    expect(items([60, 68, 66]).join()).not.toMatch(/jacket/i)
  })

  it('reaches for a jacket only once it is genuinely cold', () => {
    expect(items([54, 54, 54])).toContain('Light jacket')
    expect(items([56, 56, 56])).not.toContain('Light jacket')
  })

  it('dresses for the coldest point, not the average', () => {
    // A 30° dawn and an 80° afternoon still means thermals in the bag.
    expect(items([30, 80, 70])).toContain('Thermals')
  })

  it('scales from thermals to shorts', () => {
    expect(items([20, 20, 20])).toContain('Puffer jacket')
    expect(items([40, 40, 40])).toContain('Warm jacket')
    expect(items([72, 72, 72])).toContain('T-shirt')
    expect(items([85, 85, 85])).toContain('Shorts')
  })

  it('adds rain gear once rain is likely', () => {
    expect(items([60, 60, 60], 'average', { rain: 10 })).not.toContain('Rain jacket')
    expect(items([60, 60, 60], 'average', { rain: 50 })).toContain('Rain jacket')
    expect(items([60, 60, 60], 'average', { rain: 50 })).toContain('Waterproof shoes')
  })

  it('only reaches for rain pants when it is really coming down', () => {
    expect(items([60, 60, 60], 'average', { rain: 50 })).not.toContain('Rain pants')
    expect(items([60, 60, 60], 'average', { rain: 80 })).toContain('Rain pants')
  })

  it('uses the wettest point of the day, not the first', () => {
    const result = recommendWardrobe(
      [point(60), point(60), point(60, { rain: 70 })],
      'average',
    )
    expect(result.items).toContain('Rain jacket')
  })

  it('adds a windbreaker when a mild day is windy', () => {
    expect(items([64, 64, 64], 'average', { wind: 25 })).toContain('Windbreaker')
    expect(items([64, 64, 64], 'average', { wind: 5 })).not.toContain('Windbreaker')
  })

  it('does not stack a windbreaker on top of a coat', () => {
    // Already has a jacket; another shell is noise.
    expect(items([40, 40, 40], 'average', { wind: 30 })).not.toContain('Windbreaker')
  })

  it('dresses someone who runs cold for colder weather than the thermometer', () => {
    expect(items([62, 62, 62], 'cold')).toContain('Light jacket')
    expect(items([62, 62, 62], 'average')).not.toContain('Light jacket')
  })

  it('dresses someone who runs warm more lightly', () => {
    expect(items([72, 72, 72], 'warm')).toContain('Shorts')
    expect(items([72, 72, 72], 'average')).toContain('Long pants')
  })

  it('suggests sun cover when it gets properly hot', () => {
    expect(items([90, 90, 90])).toContain('Sun hat')
    expect(items([70, 70, 70])).not.toContain('Sun hat')
  })

  it('calls out a swing worth layering for', () => {
    expect(recommendWardrobe([point(40), point(65), point(58)], 'average').swingNote)
      .toMatch(/25° swing/)
  })

  it('stays quiet when the day is steady', () => {
    expect(recommendWardrobe([point(60), point(64), point(62)], 'average').swingNote)
      .toBeUndefined()
  })

  it('reports wind only when it is worth knowing about', () => {
    expect(recommendWardrobe([point(60, { wind: 24 })], 'average').windNote)
      .toMatch(/24 mph/)
    expect(recommendWardrobe([point(60, { wind: 6 })], 'average').windNote)
      .toBeUndefined()
  })

  it('returns nothing for no data rather than guessing', () => {
    expect(recommendWardrobe([], 'average').items).toEqual([])
  })
})

describe('windChillF', () => {
  it('leaves warm weather alone', () => {
    expect(windChillF(70, 20)).toBe(70)
  })

  it('leaves still air alone', () => {
    expect(windChillF(30, 1)).toBe(30)
  })

  it('makes a cold windy day feel colder', () => {
    // NWS: 30°F at 20mph feels like about 17°F.
    expect(windChillF(30, 20)).toBeCloseTo(17, 0)
  })

  it('bites harder as the wind picks up', () => {
    expect(windChillF(20, 35)).toBeLessThan(windChillF(20, 10))
  })
})
