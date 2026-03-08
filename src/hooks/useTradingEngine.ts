import { useRef, useCallback, useState, useEffect } from 'react';
import { ParticleFilter } from '@/lib/particleFilter';
import { runMonteCarlo } from '@/lib/monteCarloEngine';
import { BrierTracker } from '@/lib/brierScore';
import { DecisionEngine } from '@/lib/decisionEngine';
import type {
  Market, ParticleFilterState, MonteCarloResult, BrierState,
  Decision, HardRule, DecisionLogEntry, GovernanceState
} from '@/lib/types';

export function useTradingEngine() {
  const pfRef = useRef<ParticleFilter | null>(null);
  if (!pfRef.current) {
    pfRef.current = new ParticleFilter();
  }
  const brierRef = useRef<BrierTracker | null>(null);
  if (!brierRef.current) {
    brierRef.current = new BrierTracker();
  }
  const decisionRef = useRef<DecisionEngine | null>(null);
  if (!decisionRef.current) {
    decisionRef.current = new DecisionEngine();
  }

  const defaultBrierState: BrierState = { score: 0, entries: [], calibrationLabel: 'GOOD' };

  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [pfState, setPfState] = useState<ParticleFilterState>(pfRef.current!.getState());
  const [mcResult, setMcResult] = useState<MonteCarloResult>({
    probability: 0.5, stdError: 0, ci95: [0, 1], nPaths: 0, samples: [],
  });
  const [brierState, setBrierState] = useState<BrierState>(brierRef.current?.getState?.() ?? defaultBrierState);
  const [decision, setDecision] = useState<Decision>({
    action: 'HOLD', reason: 'Awaiting market selection.', conditions: [], edge: 0, timestamp: Date.now(),
  });
  const [rules, setRules] = useState<HardRule[]>([]);
  const [governance, setGovernance] = useState<GovernanceState>({
    weeklyTarget: 500,
    weeklyProgress: 0,
    decisionLog: [],
  });
  const [isLive, setIsLive] = useState(false);

  const selectMarket = useCallback((market: Market) => {
    setSelectedMarket(market);
    pfRef.current.reset(market.yesPrice);
    brierRef.current?.reset();
    setPfState(pfRef.current.getState());
    setBrierState(brierRef.current?.getState?.() ?? defaultBrierState);
    setIsLive(true);
  }, []);

  const processObservation = useCallback((market: Market) => {
    // 1. Feed real price to particle filter
    pfRef.current.update(market.yesPrice);
    const newPfState = pfRef.current.getState();
    setPfState(newPfState);

    // 2. Record for Brier score
    brierRef.current?.record(newPfState.estimate, market.yesPrice);
    setBrierState(brierRef.current?.getState?.() ?? defaultBrierState);

    // 3. Run Monte Carlo on filtered probability
    const timeToExpiry = market.endDate
      ? Math.max(0.001, (new Date(market.endDate).getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000))
      : 0.1;

    // Derive volatility from price history
    const history = newPfState.history;
    let vol = 0.03; // default
    if (history.length >= 2) {
      const returns: number[] = [];
      for (let i = 1; i < history.length; i++) {
        const r = Math.log(history[i].estimate / history[i - 1].estimate);
        if (isFinite(r)) returns.push(r);
      }
      if (returns.length > 0) {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
        vol = Math.max(0.01, Math.sqrt(variance));
      }
    }

    const mc = runMonteCarlo(newPfState.estimate, vol, timeToExpiry);
    setMcResult(mc);

    // 4. Decision engine
    const ci = newPfState.credibleInterval;
    const ciWidth = ci[1] - ci[0];
    const newDecision = decisionRef.current!.evaluate(
      newPfState.estimate, market.yesPrice, newPfState.ess, ciWidth
    );
    
    // Log decision changes
    setDecision(prev => {
      if (prev.action !== newDecision.action && selectedMarket) {
        setGovernance(g => ({
          ...g,
          decisionLog: [
            {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              action: newDecision.action,
              market: selectedMarket.question.slice(0, 50),
              reason: newDecision.reason,
            },
            ...g.decisionLog,
          ].slice(0, 50),
        }));
      }
      return newDecision;
    });

    // 5. Rules
    const newRules = decisionRef.current!.evaluateRules(
      newPfState.estimate, market.yesPrice, newPfState.ess
    );
    setRules(newRules);
  }, [selectedMarket]);

  // Auto-process when selected market updates
  useEffect(() => {
    if (selectedMarket && isLive) {
      processObservation(selectedMarket);
    }
  }, [selectedMarket?.yesPrice]);

  return {
    selectedMarket,
    selectMarket,
    processObservation,
    pfState,
    mcResult,
    brierState,
    decision,
    rules,
    governance,
    isLive,
    getParticleProbabilities: () => pfRef.current.getParticleProbabilities(),
  };
}
