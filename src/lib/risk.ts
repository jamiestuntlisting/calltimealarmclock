import type { TravelEstimate } from '../types'

/** z-score at the 90th percentile of a standard normal. */
const Z90 = 1.2816

/**
 * Nothing is certain, so the model never reports better than 99%. This is the
 * "assuming nothing goes wrong" ceiling — a flat tire is not in the data.
 */
export const MAX_LIKELIHOOD = 0.99
const MIN_LIKELIHOOD = 0.01

/**
 * Real-world noise the routing provider cannot see: a gas stop, a badge line,
 * keys in the other jacket. Even a ten minute walk is not deterministic, so
 * every estimate carries at least this much spread.
 */
function floorSigma(expectedMinutes: number): number {
  return Math.max(2, expectedMinutes * 0.05)
}

/**
 * Spread of the travel-time distribution, in minutes.
 *
 * Google returns an optimistic and a pessimistic duration alongside its best
 * guess. Those are not labelled percentiles, but they behave like a roughly
 * 10th/90th bracket, so we back out a standard deviation from their width.
 */
export function travelSigma(estimate: TravelEstimate): number {
  const spread = estimate.pessimisticMinutes - estimate.optimisticMinutes
  const fromSpread = spread > 0 ? spread / (2 * Z90) : 0
  return Math.max(fromSpread, floorSigma(estimate.expectedMinutes))
}

/** Abramowitz & Stegun 7.1.26 — plenty accurate for a percentage on a screen. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x)
  return sign * y
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/**
 * Probability of arriving by call time, given how many minutes of travel
 * budget the plan leaves. `budgetMinutes` is the gap between leaving and the
 * call — so it already includes whatever early buffer the performer wants.
 */
export function onTimeLikelihood(estimate: TravelEstimate, budgetMinutes: number): number {
  const sigma = travelSigma(estimate)
  const z = (budgetMinutes - estimate.expectedMinutes) / sigma
  return clampLikelihood(normalCdf(z))
}

export function clampLikelihood(p: number): number {
  return Math.min(MAX_LIKELIHOOD, Math.max(MIN_LIKELIHOOD, p))
}

/**
 * Travel budget needed to hit a target likelihood. Used to tell a performer
 * how much earlier they would have to leave to clear their own threshold.
 */
export function budgetForLikelihood(estimate: TravelEstimate, likelihood: number): number {
  const target = clampLikelihood(likelihood)
  // Inverse normal CDF, Beasley-Springer-Moro style rational approximation.
  const z = inverseNormalCdf(target)
  return estimate.expectedMinutes + z * travelSigma(estimate)
}

function inverseNormalCdf(p: number): number {
  // Acklam's algorithm, trimmed to the central + tail branches we need.
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924]
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857]
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878]
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742]
  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}
