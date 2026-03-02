import { useLiveClock } from '@/hooks/useLiveClock';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

interface TopBarProps {
  isLive: boolean;
  brierScore: number;
  nParticles: number;
  rightCollapsed?: boolean;
  onToggleRight?: () => void;
}

export function TopBar({ isLive, brierScore, nParticles, rightCollapsed, onToggleRight }: TopBarProps) {
  const { formatted } = useLiveClock();

  return (
    <header className="h-11 bg-background border-b border-border flex items-center px-4 gap-4 z-50">
      <span className="font-display text-[15px] font-bold tracking-tight text-primary glow-primary-strong">
        TRADING OS
      </span>
      <span className="text-[9px] text-muted-foreground font-mono">×</span>
      <span className="text-[9px] text-muted-foreground tracking-wide font-mono">POLYMARKET</span>

      <div className="flex gap-2 ml-auto items-center">
        {isLive && (
          <span className="text-[9px] tracking-wide px-2 py-0.5 rounded bg-primary/8 text-primary border border-primary/20 animate-pulse-live font-mono">
            ● LIVE
          </span>
        )}
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
          BRIER {brierScore.toFixed(3)}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
          N={nParticles.toLocaleString()}
        </span>
        <span className="text-[9px] text-muted-foreground font-mono">
          {formatted}
        </span>
        {onToggleRight && (
          <button
            onClick={onToggleRight}
            className="ml-1 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={rightCollapsed ? 'Show governance panel' : 'Hide governance panel'}
          >
            {rightCollapsed ? <PanelRightOpen className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </header>
  );
}
