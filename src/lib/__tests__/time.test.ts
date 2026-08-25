import { describe, expect, it } from 'vitest'
import { addMinutes, combineDateAndTime, daysUntil, formatDuration, formatRelativeDay, isDifferentDay, minutesBetween, toDateInput } from '../time'

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

describe('formatRelativeDay', () => {
  const now = new Date('2026-08-25T09:00:00')

  it('names today and tomorrow', () => {
    expect(formatRelativeDay(new Date('2026-08-25T06:00:00'), now)).toBe('Today: Tue Aug 25')
    expect(formatRelativeDay(new Date('2026-08-26T06:00:00'), now)).toBe('Tomorrow: Wed Aug 26')
  })

  it('states the date plainly once it is further out', () => {
    expect(formatRelativeDay(new Date('2026-08-28T06:00:00'), now)).toBe('Fri Aug 28')
  })

  it('compares calendar days, not elapsed hours', () => {
    // 23:00 today to 01:00 tomorrow is two hours but still counts as tomorrow.
    expect(formatRelativeDay(new Date('2026-08-26T01:00:00'), new Date('2026-08-25T23:00:00')))
      .toMatch(/^Tomorrow:/)
  })

  it('handles a month boundary', () => {
    expect(formatRelativeDay(new Date('2026-09-01T06:00:00'), new Date('2026-08-31T09:00:00')))
      .toBe('Tomorrow: Tue Sep 1')
  })
})

describe('daysUntil', () => {
  it('ignores the time of day', () => {
    expect(daysUntil(new Date('2026-08-26T23:00:00'), new Date('2026-08-25T01:00:00'))).toBe(1)
  })

  it('goes negative for the past', () => {
    expect(daysUntil(new Date('2026-08-24T12:00:00'), new Date('2026-08-25T12:00:00'))).toBe(-1)
  })
})
