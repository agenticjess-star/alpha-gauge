import type { Market, ParticleFilterState, MonteCarloResult, BrierState, Decision } from '@/lib/types';
import { ParticleCanvas } from './ParticleCanvas';
import { MonteCarloGrid } from './MonteCarloGrid';
import { BrierScoreDisplay } from './BrierScoreDisplay';
import { ConfidenceStrip } from './ConfidenceStrip';
import { DecisionEngineDisplay } from './DecisionEngineDisplay';

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
  const probPercent = (pfState.estimate * 100).toFixed(0);
  const probColor =
    pfState.estimate >= 0.6 ? 'text-primary glow-primary' :
    pfState.estimate >= 0.4 ? 'text-warning glow-warning' :
    'text-destructive glow-destructive';

  const ci = pfState.credibleInterval;
  const daysToExpiry = market?.endDate
    ? Math.max(0, Math.ceil((new Date(market.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="overflow-y-auto">
      {/* Hero Probability */}
      <div className="px-7 pt-6 pb-5 border-b border-border bg-gradient-to-b from-primary/[0.03] to-transparent">
        <div className="text-[9px] tracking-[2px] text-muted-foreground mb-2">
          FILTERED PROBABILITY · {market?.question?.toUpperCase().slice(0, 50) || 'SELECT A MARKET'}
        </div>

        <ConfidenceStrip ci={ci} estimate={pfState.estimate} />

        <div className={`font-display text-[96px] leading-none tracking-[2px] transition-colors duration-500 ${probColor}`}>
          {market ? probPercent : '--'}
        </div>

        <div className="flex gap-6 mt-3">
          <div>
            <div className="text-[9px] text-muted-foreground tracking-[1px] mb-0.5">MARKET PRICE</div>
            <div className="text-[13px] text-foreground">{market ? (market.yesPrice * 100).toFixed(1) + '¢' : '--'}</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground tracking-[1px] mb-0.5">YOUR EDGE</div>
            <div className={`text-[13px] ${decision.edge >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {market ? (decision.edge > 0 ? '+' : '') + (decision.edge * 100).toFixed(1) + '%' : '--'}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground tracking-[1px] mb-0.5">95% CI</div>
            <div className="text-[13px] text-foreground">
              {market ? `${(ci[0] * 100).toFixed(0)}-${(ci[1] * 100).toFixed(0)}%` : '--'}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground tracking-[1px] mb-0.5">ESS</div>
            <div className="text-[13px] text-foreground">{market ? pfState.ess.toFixed(0) : '--'}</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground tracking-[1px] mb-0.5">EXPIRES</div>
            <div className="text-[13px] text-foreground">{daysToExpiry !== null ? `${daysToExpiry}D` : '--'}</div>
          </div>
        </div>
      </div>

      {/* Particle Filter Visualization */}
      <div className="px-7 py-4 border-b border-border">
        <div className="text-[9px] tracking-[2px] text-muted-foreground mb-3">
          PARTICLE FILTER · PROBABILITY DISTRIBUTION
        </div>
        <ParticleCanvas
          particles={pfState.logitParticles}
          weights={pfState.weights}
          width={560}
          height={80}
        />
        <div className="flex gap-4 mt-2.5">
          <span className="text-[10px] text-muted-foreground">
            UPDATES: <span className="text-foreground">{pfState.updateCount}</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            PROC VOL: <span className="text-foreground">3%</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            OBS NOISE: <span className="text-foreground">2%</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            LAST OBS: <span className="text-foreground">
              {pfState.lastObservation !== null ? (pfState.lastObservation * 100).toFixed(1) + '¢' : '--'}
            </span>
          </span>
        </div>
      </div>

      {/* Monte Carlo Grid */}
      <div className="px-7 py-4 border-b border-border">
        <div className="text-[9px] tracking-[2px] text-muted-foreground mb-3">
          MONTE CARLO SAMPLE · N={mcResult.nPaths}
        </div>
        <MonteCarloGrid samples={mcResult.samples} />
      </div>

      {/* Brier Score */}
      <div className="px-7 py-4 border-b border-border">
        <BrierScoreDisplay state={brierState} />
      </div>

      {/* Decision Engine */}
      <div className="px-7 py-4 border-b border-border">
        <div className="text-[9px] tracking-[2px] text-muted-foreground mb-3">
          DECISION ENGINE
        </div>
        <DecisionEngineDisplay decision={decision} />
      </div>
    </div>
  );
}
