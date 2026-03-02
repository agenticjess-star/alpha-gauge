import type { UpDownMarket } from '@/lib/updownTypes';

interface UpDownDisplayProps {
  market: UpDownMarket | null;
  loading: boolean;
  error: string | null;
}

export function UpDownDisplay({ market, loading, error }: UpDownDisplayProps) {
  if (loading) {
    return (
      <div className="px-3 py-4 text-center">
        <span className="text-[9px] text-muted-foreground font-mono tracking-[1px] animate-pulse-live">
          DISCOVERING MARKETS...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-3">
        <span className="text-[9px] text-destructive font-mono">{error}</span>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="px-3 py-4 text-center">
        <span className="text-[9px] text-muted-foreground font-mono">
          NO ACTIVE MARKET FOUND
        </span>
      </div>
    );
  }

  const upPct = market.upPrice !== null ? (market.upPrice * 100).toFixed(1) : '—';
  const downPct = market.downPrice !== null ? (market.downPrice * 100).toFixed(1) : '—';
  const expiresIn = market.endDate
    ? getTimeRemaining(market.endDate)
    : null;

  return (
    <div className="px-3 py-2 border-b border-border">
      {/* Title */}
      <div className="text-[10px] text-foreground font-medium leading-[1.3] mb-2 line-clamp-2">
        {market.eventTitle}
      </div>

      {/* Up / Down prices */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-chart-up/10 rounded px-2 py-1.5 text-center border border-chart-up/20">
          <div className="text-[8px] text-muted-foreground font-mono mb-0.5">UP</div>
          <div className="text-[16px] font-display font-bold text-chart-up">{upPct}¢</div>
        </div>
        <div className="bg-destructive/10 rounded px-2 py-1.5 text-center border border-destructive/20">
          <div className="text-[8px] text-muted-foreground font-mono mb-0.5">DOWN</div>
          <div className="text-[16px] font-display font-bold text-destructive">{downPct}¢</div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between">
        {expiresIn && (
          <span className="text-[8px] text-muted-foreground font-mono">{expiresIn}</span>
        )}
        <a
          href={`https://polymarket.com/event/${market.eventSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[8px] text-primary hover:text-primary/80 font-mono transition-colors"
        >
          VIEW ON POLYMARKET ↗
        </a>
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
  if (hrs < 24) return `${hrs}h ${mins % 60}m left`;
  const days = Math.floor(hrs / 24);
  return `${days}d left`;
}
