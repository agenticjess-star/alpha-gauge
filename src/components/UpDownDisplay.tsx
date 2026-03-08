import type { UpDownMarket } from '@/lib/updownTypes';

interface UpDownDisplayProps {
  market: UpDownMarket | null;
  loading: boolean;
  error: string | null;
  liveSpotPrice: number | null;
  spotConnected: boolean;
  clobConnected?: boolean;
  clobLastUpdate?: number | null;
}

export function UpDownDisplay({ market, loading, error, liveSpotPrice, spotConnected, clobConnected, clobLastUpdate }: UpDownDisplayProps) {
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
  const expiresIn = market.endDate ? getTimeRemaining(market.endDate) : null;

  // Derive the "price to beat" from the market title (e.g. "BTC above $87,500")
  const priceToBeat = extractPriceToBeat(market.eventTitle);

  // Compare live spot price vs price to beat
  const spotAbove = liveSpotPrice !== null && priceToBeat !== null
    ? liveSpotPrice >= priceToBeat
    : null;

  return (
    <div className="px-3 py-2 border-b border-border">
      {/* Title + Live Spot */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-[10px] text-foreground font-medium leading-[1.3] line-clamp-2 flex-1">
          {market.eventTitle}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-0.5" title="RTDS spot price feed">
            <span className={`w-1.5 h-1.5 rounded-full ${spotConnected ? 'bg-chart-up animate-pulse-live' : 'bg-muted-foreground'}`} />
            <span className="text-[7px] text-muted-foreground font-mono">SPOT</span>
          </div>
          <div className="flex items-center gap-0.5" title="CLOB market WebSocket">
            <span className={`w-1.5 h-1.5 rounded-full ${clobConnected ? 'bg-primary animate-pulse-live' : 'bg-muted-foreground'}`} />
            <span className="text-[7px] text-muted-foreground font-mono">CLOB</span>
          </div>
        </div>
      </div>

      {/* Live Spot Price */}
      {liveSpotPrice !== null && (
        <div className={`rounded px-2 py-1.5 mb-2 border ${
          spotAbove === true
            ? 'bg-chart-up/8 border-chart-up/20'
            : spotAbove === false
            ? 'bg-destructive/8 border-destructive/20'
            : 'bg-secondary border-border'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-muted-foreground font-mono">LIVE SPOT</span>
            {priceToBeat !== null && (
              <span className="text-[8px] text-muted-foreground font-mono">
                BEAT: ${priceToBeat.toLocaleString()}
              </span>
            )}
          </div>
          <div className={`text-[18px] font-display font-bold leading-none mt-0.5 ${
            spotAbove === true ? 'text-chart-up' :
            spotAbove === false ? 'text-destructive' :
            'text-foreground'
          }`}>
            ${liveSpotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {spotAbove !== null && (
              <span className="text-[10px] ml-1 font-mono">
                {spotAbove ? '▲ ABOVE' : '▼ BELOW'}
              </span>
            )}
          </div>
        </div>
      )}

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

/** Extract the numeric price threshold from market titles like "BTC above $87,500" */
function extractPriceToBeat(title: string): number | null {
  // Match patterns like "$87,500" or "$2,345.67" or "$150"
  const match = title.match(/\$([0-9,]+(?:\.\d+)?)/);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}
