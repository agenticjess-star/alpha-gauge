// ============================================================
// Decision Engine — Rule-Based Action Logic
// Evaluates real edge, real rules, real thresholds
// Outputs BUY, HOLD, or EXIT with specific conditions
// ============================================================

import type { ActionType, Condition, Decision, HardRule, DecisionEngineConfig } from './types';

const DEFAULT_CONFIG: DecisionEngineConfig = {
  minEdge: 0.05,          // 5% minimum edge to trigger BUY
  maxPosition: 500,        // $500 max position size
  stopLoss: 0.15,          // 15% stop loss
  dailyLossLimit: 100,     // $100 max daily loss
  maxContracts: 5,         // max 5 simultaneous contracts
};

export class DecisionEngine {
  private config: DecisionEngineConfig;
  private currentPositions: number = 0;
  private dailyLoss: number = 0;
  private positionSize: number = 0;

  constructor(config?: Partial<DecisionEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate decision based on real inputs.
   * 
   * @param filteredProb - Particle filter estimate
   * @param marketPrice - Current market price from Polymarket
   * @param ess - Effective Sample Size from particle filter
   * @param ciWidth - Width of 95% credible interval
   */
  evaluate(
    filteredProb: number,
    marketPrice: number,
    ess: number,
    ciWidth: number,
  ): Decision {
    const edge = filteredProb - marketPrice;
    const absEdge = Math.abs(edge);

    const conditions: Condition[] = [];

    // Condition 1: Edge exceeds minimum threshold
    const edgeMet = absEdge >= this.config.minEdge;
    conditions.push({
      name: `Edge ≥ ${(this.config.minEdge * 100).toFixed(0)}%`,
      met: edgeMet,
      value: `${(edge * 100).toFixed(1)}%`,
    });

    // Condition 2: ESS is healthy (particles haven't collapsed)
    const essMet = ess > 500;
    conditions.push({
      name: 'ESS > 500 (filter healthy)',
      met: essMet,
      value: ess.toFixed(0),
    });

    // Condition 3: Confidence interval is reasonably tight
    const ciMet = ciWidth < 0.15;
    conditions.push({
      name: 'CI width < 15%',
      met: ciMet,
      value: `${(ciWidth * 100).toFixed(1)}%`,
    });

    // Condition 4: Position limits not exceeded
    const positionMet = this.currentPositions < this.config.maxContracts;
    conditions.push({
      name: `Positions < ${this.config.maxContracts}`,
      met: positionMet,
      value: `${this.currentPositions}/${this.config.maxContracts}`,
    });

    // Condition 5: Daily loss limit not breached
    const lossMet = this.dailyLoss < this.config.dailyLossLimit;
    conditions.push({
      name: `Daily loss < $${this.config.dailyLossLimit}`,
      met: lossMet,
      value: `$${this.dailyLoss.toFixed(0)}`,
    });

    // Decision logic
    let action: ActionType;
    let reason: string;

    if (!lossMet) {
      action = 'EXIT';
      reason = 'Daily loss limit breached. Exit all positions.';
    } else if (!essMet) {
      action = 'HOLD';
      reason = 'Particle filter degraded. Insufficient confidence for action.';
    } else if (edgeMet && ciMet && positionMet && edge > 0) {
      action = 'BUY';
      reason = `Positive edge of ${(edge * 100).toFixed(1)}% with tight CI. Signal to enter YES.`;
    } else if (edgeMet && ciMet && positionMet && edge < 0) {
      action = 'BUY';
      reason = `Negative edge of ${(edge * 100).toFixed(1)}%. Signal to enter NO.`;
    } else if (absEdge < 0.02) {
      action = 'HOLD';
      reason = 'Edge too small. Market price reflects fair value.';
    } else {
      action = 'HOLD';
      reason = 'Conditions not fully met. Waiting for clearer signal.';
    }

    return {
      action,
      reason,
      conditions,
      edge,
      timestamp: Date.now(),
    };
  }

  /** Evaluate hard rules — these cannot be overridden */
  evaluateRules(
    filteredProb: number,
    marketPrice: number,
    ess: number,
  ): HardRule[] {
    const edge = Math.abs(filteredProb - marketPrice);

    return [
      {
        name: 'Max Position Size',
        value: `$${this.positionSize.toFixed(0)}`,
        threshold: `$${this.config.maxPosition}`,
        violated: this.positionSize > this.config.maxPosition,
      },
      {
        name: 'Stop Loss',
        value: `${(edge * 100).toFixed(1)}%`,
        threshold: `${(this.config.stopLoss * 100).toFixed(0)}%`,
        violated: edge > this.config.stopLoss,
      },
      {
        name: 'Daily Loss Limit',
        value: `$${this.dailyLoss.toFixed(0)}`,
        threshold: `$${this.config.dailyLossLimit}`,
        violated: this.dailyLoss >= this.config.dailyLossLimit,
      },
      {
        name: 'Max Contracts',
        value: `${this.currentPositions}`,
        threshold: `${this.config.maxContracts}`,
        violated: this.currentPositions >= this.config.maxContracts,
      },
      {
        name: 'Filter Health (ESS)',
        value: ess.toFixed(0),
        threshold: '500',
        violated: ess < 500,
      },
    ];
  }

  /** Update position tracking */
  updatePositions(count: number, size: number, dailyLoss: number): void {
    this.currentPositions = count;
    this.positionSize = size;
    this.dailyLoss = dailyLoss;
  }
}
