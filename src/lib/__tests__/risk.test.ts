import { describe, expect, it } from 'vitest'
import { MAX_LIKELIHOOD, budgetForLikelihood, onTimeLikelihood, travelSigma } from '../risk'
import type { TravelEstimate } from '../../types'

const estimate = (o: number, e: number, p: number): TravelEstimate => ({
  optimisticMinutes: o,
  expectedMinutes: e,
  pessimisticMinutes: p,
  distanceMeters: 20000,
  source: 'mock',
})

describe('travelSigma', () => {
  it('derives spread from the optimistic/pessimistic bracket', () => {
    // A 30-minute bracket read as a 10th-to-90th spread.
    expect(travelSigma(estimate(30, 45, 60))).toBeCloseTo(30 / 2.5632, 2)
  })

  it('never drops below the real-world noise floor', () => {
    // Provider reports zero spread; the model still refuses to be certain.
    expect(travelSigma(estimate(40, 40, 40))).toBe(2)
  })

  it('scales the noise floor with trip length', () => {
    expect(travelSigma(estimate(120, 120, 120))).toBe(6)
  })
})

describe('onTimeLikelihood', () => {
  it('is near even money when the budget only covers the expected trip', () => {
    expect(onTimeLikelihood(estimate(30, 45, 60), 45)).toBeCloseTo(0.5, 2)
  })

  it('rises as buffer is added', () => {
    const tight = onTimeLikelihood(estimate(30, 45, 60), 45)
    const roomy = onTimeLikelihood(estimate(30, 45, 60), 60)
    expect(roomy).toBeGreaterThan(tight)
  })

  it('caps at 99% no matter how much padding is added', () => {
    expect(onTimeLikelihood(estimate(30, 45, 60), 600)).toBe(MAX_LIKELIHOOD)
  })

  it('reports low odds when the budget is under the expected trip', () => {
    expect(onTimeLikelihood(estimate(30, 45, 60), 20)).toBeLessThan(0.05)
  })

  it('treats a wider traffic bracket as riskier for the same buffer', () => {
    const calm = onTimeLikelihood(estimate(43, 45, 47), 55)
    const chaotic = onTimeLikelihood(estimate(25, 45, 90), 55)
    expect(calm).toBeGreaterThan(chaotic)
  })
})

describe('budgetForLikelihood', () => {
  it('round-trips against onTimeLikelihood', () => {
    const e = estimate(30, 45, 60)
    const budget = budgetForLikelihood(e, 0.9)
    expect(onTimeLikelihood(e, budget)).toBeCloseTo(0.9, 2)
  })

  it('demands more budget for a higher confidence', () => {
    const e = estimate(30, 45, 60)
    expect(budgetForLikelihood(e, 0.95)).toBeGreaterThan(budgetForLikelihood(e, 0.75))
  })
})
