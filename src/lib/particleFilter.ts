// ============================================================
// Sequential Monte Carlo — Particle Filter
// Real Bayesian inference engine for prediction market probabilities
// Direct TypeScript port of the Python PredictionMarketParticleFilter
// ============================================================

import type { ParticleFilterConfig, ParticleFilterState, ParticleFilterSnapshot } from './types';

/** Logistic sigmoid: maps logit space -> probability space */
function expit(x: number): number {
  if (x >= 0) {
    const ez = Math.exp(-x);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(x);
  return ez / (1 + ez);
}

/** Inverse sigmoid: maps probability -> logit space */
function logit(p: number): number {
  const clamped = Math.max(1e-10, Math.min(1 - 1e-10, p));
  return Math.log(clamped / (1 - clamped));
}

/** Box-Muller transform for standard normal samples */
function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export class ParticleFilter {
  private config: ParticleFilterConfig;
  private logitParticles: Float64Array;
  private weights: Float64Array;
  private history: ParticleFilterSnapshot[] = [];
  private updateCount = 0;
  private lastObservation: number | null = null;

  constructor(config?: Partial<ParticleFilterConfig>) {
    this.config = {
      nParticles: config?.nParticles ?? 5000,
      processVol: config?.processVol ?? 0.03,
      obsNoise: config?.obsNoise ?? 0.02,
      priorProb: config?.priorProb ?? 0.5,
    };

    const N = this.config.nParticles;
    this.logitParticles = new Float64Array(N);
    this.weights = new Float64Array(N);

    // Initialize particles around prior in logit space
    const logitPrior = logit(this.config.priorProb);
    for (let i = 0; i < N; i++) {
      this.logitParticles[i] = logitPrior + randn() * 0.5;
      this.weights[i] = 1 / N;
    }
  }

  /** Incorporate a new real observation (market price) */
  update(observedPrice: number): void {
    const N = this.config.nParticles;
    const { processVol, obsNoise } = this.config;

    // 1. Propagate: random walk in logit space
    for (let i = 0; i < N; i++) {
      this.logitParticles[i] += randn() * processVol;
    }

    // 2. Reweight: likelihood of observation given each particle
    let maxLogWeight = -Infinity;
    const logWeights = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      const probParticle = expit(this.logitParticles[i]);
      const diff = observedPrice - probParticle;
      const logLikelihood = -0.5 * (diff / obsNoise) ** 2;
      logWeights[i] = Math.log(this.weights[i] + 1e-300) + logLikelihood;
      if (logWeights[i] > maxLogWeight) maxLogWeight = logWeights[i];
    }

    // Normalize in log space for numerical stability
    let sumWeights = 0;
    for (let i = 0; i < N; i++) {
      this.weights[i] = Math.exp(logWeights[i] - maxLogWeight);
      sumWeights += this.weights[i];
    }
    for (let i = 0; i < N; i++) {
      this.weights[i] /= sumWeights;
    }

    // 3. Check ESS and resample if needed
    const ess = this.computeESS();
    if (ess < N / 2) {
      this.systematicResample();
    }

    this.updateCount++;
    this.lastObservation = observedPrice;

    this.history.push({
      timestamp: Date.now(),
      estimate: this.estimate(),
      ci: this.credibleInterval(),
      ess: this.computeESS(),
      observation: observedPrice,
    });
  }

  /** Systematic resampling — lower variance than multinomial */
  private systematicResample(): void {
    const N = this.config.nParticles;
    const cumsum = new Float64Array(N);
    cumsum[0] = this.weights[0];
    for (let i = 1; i < N; i++) {
      cumsum[i] = cumsum[i - 1] + this.weights[i];
    }

    const newParticles = new Float64Array(N);
    const u0 = Math.random() / N;

    let j = 0;
    for (let i = 0; i < N; i++) {
      const u = u0 + i / N;
      while (j < N - 1 && cumsum[j] < u) j++;
      newParticles[i] = this.logitParticles[j];
    }

    this.logitParticles = newParticles;
    for (let i = 0; i < N; i++) {
      this.weights[i] = 1 / N;
    }
  }

  /** Weighted mean probability estimate */
  estimate(): number {
    let sum = 0;
    for (let i = 0; i < this.config.nParticles; i++) {
      sum += this.weights[i] * expit(this.logitParticles[i]);
    }
    return sum;
  }

  /** Weighted quantile-based credible interval */
  credibleInterval(alpha = 0.05): [number, number] {
    const N = this.config.nParticles;
    const probs = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      probs[i] = expit(this.logitParticles[i]);
    }

    // Sort by probability, carry weights
    const indices = Array.from({ length: N }, (_, i) => i);
    indices.sort((a, b) => probs[a] - probs[b]);

    let cumW = 0;
    let lower = probs[indices[0]];
    let upper = probs[indices[N - 1]];

    for (const idx of indices) {
      cumW += this.weights[idx];
      if (cumW >= alpha / 2 && lower === probs[indices[0]]) {
        lower = probs[idx];
      }
      if (cumW >= 1 - alpha / 2) {
        upper = probs[idx];
        break;
      }
    }

    return [lower, upper];
  }

  /** Effective Sample Size */
  computeESS(): number {
    let sumSq = 0;
    for (let i = 0; i < this.config.nParticles; i++) {
      sumSq += this.weights[i] ** 2;
    }
    return 1 / sumSq;
  }

  /** Get full state for rendering */
  getState(): ParticleFilterState {
    return {
      logitParticles: this.logitParticles,
      weights: this.weights,
      estimate: this.estimate(),
      credibleInterval: this.credibleInterval(),
      ess: this.computeESS(),
      updateCount: this.updateCount,
      lastObservation: this.lastObservation,
      history: this.history,
    };
  }

  /** Get particle probabilities for canvas visualization */
  getParticleProbabilities(): Float64Array {
    const N = this.config.nParticles;
    const probs = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      probs[i] = expit(this.logitParticles[i]);
    }
    return probs;
  }

  /** Reset with a new prior */
  reset(priorProb: number): void {
    const N = this.config.nParticles;
    const logitPrior = logit(priorProb);
    for (let i = 0; i < N; i++) {
      this.logitParticles[i] = logitPrior + randn() * 0.5;
      this.weights[i] = 1 / N;
    }
    this.history = [];
    this.updateCount = 0;
    this.lastObservation = null;
  }
}
