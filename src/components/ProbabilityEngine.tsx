import { useState } from 'react';
import type { Market, ParticleFilterState, MonteCarloResult, BrierState, Decision } from '@/lib/types';
import type { UpDownMarket } from '@/lib/updownTypes';
import type { PricePoint } from '@/hooks/usePriceHistory';
import { ParticleCanvas } from './ParticleCanvas';
import { MonteCarloGrid } from './MonteCarloGrid';
import { BrierScoreDisplay } from './BrierScoreDisplay';
import { DecisionEngineDisplay } from './DecisionEngineDisplay';
import { SpotPriceChart } from './SpotPriceChart';

interface ProbabilityEngineProps {
  market: Market | null;
  pfState: ParticleFilterState;
  mcResult: MonteCarloResult;
  brierState: BrierState;
  decision: Decision;
  getParticles: () => Float64Array;
  liveSpotPrice?: number | null;
  spotAsset?: string;
  upDownMarket?: UpDownMarket | null;
  priceHistory?: PricePoint[];
}

function extractPriceToBeat(title: string): number | null {
  const match = title.match(/\$([0-9,]+(?:\.\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, '')) || null;
}

export function ProbabilityEngine({
  market, pfState, mcResult, brierState, decision, getParticles,
  liveSpotPrice, spotAsset, upDownMarket, priceHistory = []
}: ProbabilityEngineProps) {
  const upPct = upDownMarket?.upPrice != null ? (upDownMarket.upPrice * 100) : null;
  const downPct = upDownMarket?.downPrice != null ? (upDownMarket.downPrice * 100) : null;
  const priceToBeat = upDownMarket ? extractPriceToBeat(upDownMarket.eventTitle) : null;
  const spotAbove = liveSpotPrice != null && priceToBeat != null ? liveSpotPrice >= priceToBeat : null;

  const polymarketUrl = upDownMarket?.eventSlug
    ? `https://polymarket.com/event/${upDownMarket.eventSlug}`
    : market?.slug ? `https://polymarket.com/event/${market.slug}` : null;

  const endDate = upDownMarket?.endDate || market?.endDate;
  const timeLeft = endDate ? getTimeRemaining(endDate) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Hero: Live Spot + Up/Down Prices */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        {/* Market title + link */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-foreground/70 font-medium leading-snug line-clamp-1 flex-1 mr-2">
            {upDownMarket?.eventTitle || market?.question || 'Select a market'}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {timeLeft && (
              <span className="text-[8px] text-muted-foreground font-mono px-1.5 py-0.5 bg-secondary rounded">
                {timeLeft}
              </span>
            )}
            {polymarketUrl && (
              <a href={polymarketUrl} target="_blank" rel="noopener noreferrer"
                className="text-[8px] text-primary/60 hover:text-primary font-mono transition-colors">
                POLYMARKET ↗
              </a>
            )}
          </div>
        </div>

        {/* Live Spot Price — Hero */}
        <div className="mb-4">
          <div className="text-[8px] text-muted-foreground font-mono tracking-wider mb-1">
            {(spotAsset || 'BTC').toUpperCase()} SPOT PRICE
          </div>
          <div className="flex items-baseline gap-3">
            <span className={`font-display text-[40px] leading-none font-bold tracking-tight transition-all duration-700 ${
              spotAbove === true ? 'text-chart-up glow-primary' :
              spotAbove === false ? 'text-destructive glow-destructive' :
              'text-foreground'
            }`}>
              {liveSpotPrice != null
                ? `$${liveSpotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
            </span>
            {priceToBeat != null && (
              <div className="flex flex-col">
                <span className="text-[8px] text-muted-foreground font-mono">BEAT</span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  ${priceToBeat.toLocaleString()}
                </span>
              </div>
            )}
            {spotAbove !== null && (
              <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded ${
                spotAbove ? 'bg-chart-up/10 text-chart-up' : 'bg-destructive/10 text-destructive'
              }`}>
                {spotAbove ? '▲ ABOVE' : '▼ BELOW'}
              </span>
            )}
          </div>
        </div>

        {/* Up / Down Contract Prices — THE CENTERPIECE */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-chart-up/8 rounded-lg px-4 py-3 border border-chart-up/15 transition-all duration-500">
            <div className="text-[8px] text-muted-foreground font-mono tracking-wider mb-1">UP CONTRACT</div>
            <div className="font-display text-[32px] leading-none font-bold text-chart-up transition-all duration-700">
              {upPct != null ? `${upPct.toFixed(1)}` : '—'}
              <span className="text-[14px] text-chart-up/60 ml-0.5">¢</span>
            </div>
          </div>
          <div className="bg-destructive/8 rounded-lg px-4 py-3 border border-destructive/15 transition-all duration-500">
            <div className="text-[8px] text-muted-foreground font-mono tracking-wider mb-1">DOWN CONTRACT</div>
            <div className="font-display text-[32px] leading-none font-bold text-destructive transition-all duration-700">
              {downPct != null ? `${downPct.toFixed(1)}` : '—'}
              <span className="text-[14px] text-destructive/60 ml-0.5">¢</span>
            </div>
          </div>
        </div>

        {/* Model stats row */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'FILTERED', value: market ? `${(pfState.estimate * 100).toFixed(1)}%` : '--', color: pfState.estimate >= 0.6 ? 'text-primary' : pfState.estimate <= 0.4 ? 'text-destructive' : 'text-warning' },
            { label: 'EDGE', value: market ? `${decision.edge > 0 ? '+' : ''}${(decision.edge * 100).toFixed(1)}%` : '--', color: decision.edge >= 0 ? 'text-primary' : 'text-destructive' },
            { label: '95% CI', value: market ? `${(pfState.credibleInterval[0] * 100).toFixed(0)}–${(pfState.credibleInterval[1] * 100).toFixed(0)}%` : '--' },
            { label: 'ESS', value: market ? pfState.ess.toFixed(0) : '--' },
            { label: 'BRIER', value: brierState.score > 0 ? brierState.score.toFixed(3) : '--' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-[7px] text-muted-foreground tracking-wider mb-0.5 font-mono">{stat.label}</div>
              <div className={`text-[11px] font-mono font-medium transition-all duration-500 ${stat.color || 'text-foreground'}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Large Spot Price Chart */}
      <div className="px-5 py-3 border-b border-border flex-1 min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[8px] text-muted-foreground font-mono tracking-wider">
            {(spotAsset || 'BTC').toUpperCase()}/USD · LIVE
          </span>
          <span className="text-[8px] text-muted-foreground font-mono">
            {priceHistory.length} ticks
          </span>
        </div>
        <SpotPriceChart
          history={priceHistory}
          height={240}
          priceToBeat={priceToBeat}
        />
      </div>

      {/* Compact engine panels */}
      <div className="overflow-y-auto scrollbar-thin">
        {/* Particle Filter */}
        <div className="px-5 py-2.5 border-b border-border">
          <div className="text-[7px] tracking-wider text-muted-foreground mb-1.5 font-mono">
            PARTICLE DISTRIBUTION · N={pfState.logitParticles?.length || 5000}
          </div>
          <ParticleCanvas
            particles={pfState.logitParticles}
            weights={pfState.weights}
            height={40}
          />
        </div>

        {/* Monte Carlo */}
        <div className="px-5 py-2.5 border-b border-border">
          <div className="text-[7px] tracking-wider text-muted-foreground mb-1.5 font-mono">
            MONTE CARLO · N={mcResult.nPaths}
          </div>
          <MonteCarloGrid samples={mcResult.samples} />
        </div>

        {/* Decision Engine */}
        <div className="px-5 py-2.5 border-b border-border">
          <div className="text-[7px] tracking-wider text-muted-foreground mb-1.5 font-mono">
            DECISION ENGINE
          </div>
          <DecisionEngineDisplay decision={decision} />
        </div>

        {/* Brier Score */}
        <div className="px-5 py-2.5">
          <BrierScoreDisplay state={brierState} />
        </div>
      </div>
    </div>
  );
}

function getTimeRemaining(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'EXPIRED';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d left`;
}
