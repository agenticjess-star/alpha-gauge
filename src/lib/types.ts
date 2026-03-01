// ============================================================
// Trading OS — Core Type Definitions
// All interfaces for real market data, engines, and decisions
// ============================================================

/** Raw market data from Polymarket Gamma API */
export interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  active: boolean;
  closed: boolean;
  markets: PolymarketMarket[];
}

export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  active: boolean;
  closed: boolean;
  outcomePrices: string; // JSON string of [yesPrice, noPrice]
  volume: string;
  liquidity: string;
  endDate: string;
  groupItemTitle?: string;
  conditionId?: string;
  clobTokenIds?: string; // JSON string of token IDs
}

/** Parsed market for internal use */
export interface Market {
  id: string;
  question: string;
  slug: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  closed: boolean;
}

// ============================================================
// Particle Filter Types
// ============================================================

export interface ParticleFilterConfig {
  nParticles: number;
  processVol: number;
  obsNoise: number;
  priorProb: number;
}

export interface ParticleFilterState {
  logitParticles: Float64Array;
  weights: Float64Array;
  estimate: number;
  credibleInterval: [number, number];
  ess: number;
  updateCount: number;
  lastObservation: number | null;
  history: ParticleFilterSnapshot[];
}

export interface ParticleFilterSnapshot {
  timestamp: number;
  estimate: number;
  ci: [number, number];
  ess: number;
  observation: number;
}

// ============================================================
// Monte Carlo Engine Types
// ============================================================

export interface MonteCarloConfig {
  nPaths: number;
  nStrata: number;
  useAntithetic: boolean;
}

export interface MonteCarloResult {
  probability: number;
  stdError: number;
  ci95: [number, number];
  nPaths: number;
  samples: boolean[]; // for grid visualization — actual MC outcomes
}

// ============================================================
// Brier Score Types
// ============================================================

export interface BrierEntry {
  timestamp: number;
  prediction: number;
  observation: number;
}

export interface BrierState {
  score: number;
  entries: BrierEntry[];
  calibrationLabel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

// ============================================================
// Decision Engine Types
// ============================================================

export type ActionType = 'BUY' | 'HOLD' | 'EXIT';

export interface Condition {
  name: string;
  met: boolean;
  value: string;
}

export interface Decision {
  action: ActionType;
  reason: string;
  conditions: Condition[];
  edge: number;
  timestamp: number;
}

export interface HardRule {
  name: string;
  value: string;
  threshold: string;
  violated: boolean;
}

export interface DecisionEngineConfig {
  minEdge: number;        // minimum edge to trigger BUY
  maxPosition: number;    // max position size in dollars
  stopLoss: number;       // stop loss percentage
  dailyLossLimit: number; // max daily loss in dollars
  maxContracts: number;   // max simultaneous contracts
}

// ============================================================
// Governance Types
// ============================================================

export interface DecisionLogEntry {
  id: string;
  timestamp: number;
  action: ActionType;
  market: string;
  reason: string;
  pnl?: number;
}

export interface GovernanceState {
  weeklyTarget: number;
  weeklyProgress: number;
  decisionLog: DecisionLogEntry[];
}

// ============================================================
// Trading Engine Orchestrator
// ============================================================

export interface TradingEngineState {
  selectedMarket: Market | null;
  markets: Market[];
  particleFilter: ParticleFilterState;
  monteCarlo: MonteCarloResult;
  brier: BrierState;
  decision: Decision;
  governance: GovernanceState;
  rules: HardRule[];
  isLive: boolean;
  lastUpdate: number;
}
