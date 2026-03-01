// ============================================================
// Monte Carlo Engine — Variance-Reduced Path Computation
// Antithetic variates + stratified sampling
// Operates on real filtered probabilities, not fabricated data
// ============================================================

import type { MonteCarloConfig, MonteCarloResult } from './types';

/** Box-Muller standard normal */
function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Inverse normal CDF approximation (Beasley-Springer-Moro) */
function normInv(u: number): number {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2,
    -2.759285104469687e2, 1.383577518672690e2,
    -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2,
    -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1,
    -2.400758277161838e0, -2.549732539343734e0,
    4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1,
    2.445134137142996e0, 3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (u < pLow) {
    q = Math.sqrt(-2 * Math.log(u));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (u <= pHigh) {
    q = u - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - u));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

/**
 * Run variance-reduced Monte Carlo computation on a binary contract.
 * 
 * @param filteredProb - Current filtered probability from particle filter
 * @param volatility - Historical volatility of the contract price
 * @param timeToExpiry - Time to expiry in years
 * @param config - MC configuration
 */
export function runMonteCarlo(
  filteredProb: number,
  volatility: number,
  timeToExpiry: number,
  config?: Partial<MonteCarloConfig>
): MonteCarloResult {
  const nPaths = config?.nPaths ?? 1000;
  const nStrata = config?.nStrata ?? 10;
  const useAntithetic = config?.useAntithetic ?? true;

  // Stratified sampling with antithetic variates
  const pathsPerStratum = Math.floor(nPaths / nStrata);
  const samples: boolean[] = [];
  let totalHits = 0;
  let totalPaths = 0;

  for (let j = 0; j < nStrata; j++) {
    for (let i = 0; i < pathsPerStratum; i++) {
      // Stratified uniform: sample within stratum [j/J, (j+1)/J]
      const u = (j + Math.random()) / nStrata;
      const z = normInv(u);

      // GBM terminal value in probability space
      // Using logit-space dynamics consistent with the particle filter
      const logitP = Math.log(filteredProb / (1 - filteredProb));
      const drift = -0.5 * volatility * volatility;
      const logitTerminal = logitP + drift * timeToExpiry + volatility * Math.sqrt(timeToExpiry) * z;
      const pTerminal = 1 / (1 + Math.exp(-logitTerminal));

      // Binary outcome: does the event resolve YES?
      const hit = pTerminal > 0.5;
      samples.push(hit);
      if (hit) totalHits++;
      totalPaths++;

      // Antithetic variate: use -z
      if (useAntithetic) {
        const logitTerminalAnti = logitP + drift * timeToExpiry + volatility * Math.sqrt(timeToExpiry) * (-z);
        const pTerminalAnti = 1 / (1 + Math.exp(-logitTerminalAnti));
        const hitAnti = pTerminalAnti > 0.5;
        samples.push(hitAnti);
        if (hitAnti) totalHits++;
        totalPaths++;
      }
    }
  }

  const probability = totalHits / totalPaths;
  const stdError = Math.sqrt(probability * (1 - probability) / totalPaths);
  const ci95: [number, number] = [
    Math.max(0, probability - 1.96 * stdError),
    Math.min(1, probability + 1.96 * stdError),
  ];

  return {
    probability,
    stdError,
    ci95,
    nPaths: totalPaths,
    samples: samples.slice(0, 100), // first 100 for grid visualization
  };
}
