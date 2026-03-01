import { useLiveClock } from '@/hooks/useLiveClock';
import type { BrierState } from '@/lib/types';

interface TopBarProps {
  isLive: boolean;
  brierScore: number;
  nParticles: number;
}

export function TopBar({ isLive, brierScore, nParticles }: TopBarProps) {
  const { formatted } = useLiveClock();

  return (
    <header className="h-12 bg-background border-b border-border flex items-center px-5 gap-6 z-50">
      <span className="font-display text-[22px] tracking-[3px] text-primary glow-primary-strong">
        TRADING OS
      </span>

      <div className="flex gap-4 ml-auto items-center">
        {isLive && (
          <span className="text-[10px] tracking-[1px] px-2.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/30 animate-pulse-live">
            ● PARTICLE FILTER LIVE
          </span>
        )}
        <span className="text-[10px] tracking-[1px] px-2.5 py-0.5 rounded-sm bg-secondary text-muted-foreground">
          BRIER: {brierScore.toFixed(2)}
        </span>
        <span className="text-[10px] tracking-[1px] px-2.5 py-0.5 rounded-sm bg-secondary text-muted-foreground">
          PARTICLES: {nParticles.toLocaleString()}
        </span>
        <span className="text-[11px] text-muted-foreground tracking-[1px]">
          {formatted}
        </span>
      </div>
    </header>
  );
}
