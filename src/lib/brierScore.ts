// ============================================================
// Brier Score — Real Calibration Tracking
// Measures whether the particle filter is actually well-calibrated
// against observed market prices over time
// ============================================================

import type { BrierEntry, BrierState } from './types';

export class BrierTracker {
  private entries: BrierEntry[] = [];

  /** Record a prediction vs observation pair */
  record(prediction: number, observation: number): void {
    this.entries.push({
      timestamp: Date.now(),
      prediction,
      observation,
    });
  }

  /** Compute the running Brier score: mean((prediction - outcome)^2) */
  score(): number {
    if (this.entries.length === 0) return 0;
    let sum = 0;
    for (const entry of this.entries) {
      sum += (entry.prediction - entry.observation) ** 2;
    }
    return sum / this.entries.length;
  }

  /** Classify calibration quality */
  calibrationLabel(): BrierState['calibrationLabel'] {
    const s = this.score();
    if (s < 0.10) return 'EXCELLENT';
    if (s < 0.20) return 'GOOD';
    if (s < 0.30) return 'FAIR';
    return 'POOR';
  }

  /** Get full state for rendering */
  getState(): BrierState {
    return {
      score: this.score(),
      entries: [...this.entries],
      calibrationLabel: this.calibrationLabel(),
    };
  }

  /** Reset tracker */
  reset(): void {
    this.entries = [];
  }
}
