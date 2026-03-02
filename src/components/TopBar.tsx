import { useLiveClock } from '@/hooks/useLiveClock';

interface TopBarProps {
  isLive: boolean;
  brierScore: number;
  nParticles: number;
}

export function TopBar({ isLive, brierScore, nParticles }: TopBarProps) {
  const { formatted } = useLiveClock();

  return (
    <header className="h-12 bg-background border-b border-border flex items-center px-5 gap-5 z-50">
      <span className="font-display text-[18px] font-bold tracking-tight text-primary glow-primary-strong">
        TRADING OS
      </span>
      <span className="text-[10px] text-muted-foreground font-mono">×</span>
      <span className="text-[10px] text-muted-foreground tracking-wide font-mono">POLYMARKET</span>

      <div className="flex gap-3 ml-auto items-center">
        {isLive && (
          <span className="text-[10px] tracking-wide px-2.5 py-1 rounded-md bg-primary/8 text-primary border border-primary/20 animate-pulse-live font-mono">
            ● LIVE
          </span>
        )}
        <span className="text-[10px] px-2 py-1 rounded-md bg-secondary text-muted-foreground font-mono">
          BRIER {brierScore.toFixed(3)}
        </span>
        <span className="text-[10px] px-2 py-1 rounded-md bg-secondary text-muted-foreground font-mono">
          N={nParticles.toLocaleString()}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {formatted}
        </span>
      </div>
    </header>
  );
}
