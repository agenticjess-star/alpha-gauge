import { useState } from 'react';
import type { Market, ParticleFilterState, MonteCarloResult, BrierState, Decision } from '@/lib/types';
import { ParticleCanvas } from './ParticleCanvas';
import { MonteCarloGrid } from './MonteCarloGrid';
import { BrierScoreDisplay } from './BrierScoreDisplay';
import { ConfidenceStrip } from './ConfidenceStrip';
import { DecisionEngineDisplay } from './DecisionEngineDisplay';
import { PriceChart } from './PriceChart';
import { TimeframeSelector } from './TimeframeSelector';

interface ProbabilityEngineProps {
  market: Market | null;
  pfState: ParticleFilterState;
  mcResult: MonteCarloResult;
  brierState: BrierState;
  decision: Decision;
  getParticles: () => Float64Array;
}

export function ProbabilityEngine({
  market, pfState, mcResult, brierState, decision, getParticles
}: ProbabilityEngineProps) {
  const [timeframe, setTimeframe] = useState('1H');
  const probPercent = (pfState.estimate * 100).toFixed(0);
  const probColor =
    pfState.estimate >= 0.6 ? 'text-primary glow-primary' :
    pfState.estimate >= 0.4 ? 'text-warning glow-warning' :
    'text-destructive glow-destructive';

  const ci = pfState.credibleInterval;
  const daysToExpiry = market?.endDate
    ? Math.max(0, Math.ceil((new Date(market.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const polymarketUrl = market?.slug ? `https://polymarket.com/event/${market.slug}` : null;

  return (
    <div>
      {/* Hero Probability */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[9px] tracking-wide text-muted-foreground font-mono flex items-center gap-2">
            <span>FILTERED ESTIMATE</span>
            {polymarketUrl && (
              <a href={polymarketUrl} target="_blank" rel="noopener noreferrer"
                className="text-primary/60 hover:text-primary transition-colors">
                ↗ Polymarket
              </a>
            )}
          </div>
          <TimeframeSelector active={timeframe} onChange={setTimeframe} />
        </div>

        <div className="text-[11px] text-foreground/80 font-medium mb-2 leading-snug line-clamp-2">
          {market?.question || 'Select a market to begin analysis'}
        </div>

        <ConfidenceStrip ci={ci} estimate={pfState.estimate} />

        <div className={`font-display text-[56px] leading-none font-bold tracking-tight transition-colors duration-500 ${probColor}`}>
          {market ? probPercent : '--'}
          <span className="text-[22px] text-muted-foreground ml-1">%</span>
        </div>

        <div className="grid grid-cols-5 gap-3 mt-3">
          {[
            { label: 'MARKET', value: market ? (market.yesPrice * 100).toFixed(1) + '¢' : '--' },
            { label: 'EDGE', value: market ? (decision.edge > 0 ? '+' : '') + (decision.edge * 100).toFixed(1) + '%' : '--', color: decision.edge >= 0 ? 'text-primary' : 'text-destructive' },
            { label: '95% CI', value: market ? `${(ci[0] * 100).toFixed(0)}–${(ci[1] * 100).toFixed(0)}%` : '--' },
            { label: 'ESS', value: market ? pfState.ess.toFixed(0) : '--' },
            { label: 'EXPIRES', value: daysToExpiry !== null ? `${daysToExpiry}D` : '--' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-[8px] text-muted-foreground tracking-wide mb-0.5 font-mono">{stat.label}</div>
              <div className={`text-[12px] font-mono font-medium ${stat.color || 'text-foreground'}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Price Chart */}
      <div className="px-5 py-3 border-b border-border">
        <div className="text-[8px] tracking-wide text-muted-foreground mb-2 font-mono">
          PROBABILITY TRAJECTORY · FILTERED vs MARKET
        </div>
        <PriceChart
          history={pfState.history}
          marketPrice={market?.yesPrice ?? 0.5}
          height={150}
        />
      </div>

      {/* Particle Filter */}
      <div className="px-5 py-3 border-b border-border">
        <div className="text-[8px] tracking-wide text-muted-foreground mb-2 font-mono">
          PARTICLE DISTRIBUTION
        </div>
        <ParticleCanvas
          particles={pfState.logitParticles}
          weights={pfState.weights}
          height={56}
        />
        <div className="flex gap-3 mt-1.5 flex-wrap">
          {[
            { label: 'UPDATES', value: pfState.updateCount },
            { label: 'σ_proc', value: '3%' },
            { label: 'σ_obs', value: '2%' },
            { label: 'LAST', value: pfState.lastObservation !== null ? (pfState.lastObservation * 100).toFixed(1) + '¢' : '--' },
          ].map(s => (
            <span key={s.label} className="text-[8px] text-muted-foreground font-mono">
              {s.label}: <span className="text-foreground">{s.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Monte Carlo */}
      <div className="px-5 py-3 border-b border-border">
        <div className="text-[8px] tracking-wide text-muted-foreground mb-2 font-mono">
          MONTE CARLO · N={mcResult.nPaths}
        </div>
        <MonteCarloGrid samples={mcResult.samples} />
      </div>

      {/* Brier Score */}
      <div className="px-5 py-3 border-b border-border">
        <BrierScoreDisplay state={brierState} />
      </div>

      {/* Decision Engine */}
      <div className="px-5 py-3 border-b border-border">
        <div className="text-[8px] tracking-wide text-muted-foreground mb-2 font-mono">
          DECISION ENGINE
        </div>
        <DecisionEngineDisplay decision={decision} />
      </div>
    </div>
  );
}
