import { describe, expect, it } from 'vitest'
import { addMinutes, combineDateAndTime, formatDuration, isDifferentDay, minutesBetween, toDateInput } from '../time'

describe('combineDateAndTime', () => {
  it('builds a local date from the two input fields', () => {
    const d = combineDateAndTime('2026-09-14', '05:45')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(14)
    expect(d.getHours()).toBe(5)
    expect(d.getMinutes()).toBe(45)
  })
})

describe('addMinutes', () => {
  it('crosses midnight backwards', () => {
    const d = addMinutes(combineDateAndTime('2026-09-14', '00:30'), -90)
    expect(toDateInput(d)).toBe('2026-09-13')
    expect(d.getHours()).toBe(23)
  })
})

describe('minutesBetween', () => {
  it('measures forward spans', () => {
    expect(minutesBetween(combineDateAndTime('2026-09-14', '05:00'), combineDateAndTime('2026-09-14', '06:00'))).toBe(60)
  })
})

describe('formatDuration', () => {
  it('renders minutes, hours and both', () => {
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(120)).toBe('2h')
    expect(formatDuration(80)).toBe('1h 20m')
  })

  it('never renders a negative duration', () => {
    expect(formatDuration(-5)).toBe('0m')
  })
})

describe('isDifferentDay', () => {
  it('detects an alarm that lands the day before', () => {
    expect(isDifferentDay(combineDateAndTime('2026-09-13', '23:00'), combineDateAndTime('2026-09-14', '00:30'))).toBe(true)
    expect(isDifferentDay(combineDateAndTime('2026-09-14', '04:30'), combineDateAndTime('2026-09-14', '06:00'))).toBe(false)
  })
})
