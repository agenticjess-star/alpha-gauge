import type { Market } from '@/lib/types';

interface MarketsPanelProps {
  markets: Market[];
  selectedId: string | null;
  onSelect: (market: Market) => void;
  loading: boolean;
  error: string | null;
}

export function MarketsPanel({ markets, selectedId, onSelect, loading, error }: MarketsPanelProps) {
  return (
    <div className="border-r border-border overflow-y-auto">
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
        <span className="text-[9px] tracking-[2px] text-muted-foreground uppercase">
          Active Markets
        </span>
        <span className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded-sm">
          {markets.length}
        </span>
      </div>

      {loading && (
        <div className="p-4 text-[10px] text-muted-foreground tracking-[1px] animate-pulse-live">
          CONNECTING TO POLYMARKET...
        </div>
      )}

      {error && (
        <div className="p-4 text-[10px] text-destructive">
          {error}
        </div>
      )}

      <div className="py-2">
        {markets.map((market) => {
          const isActive = market.id === selectedId;
          const priceColor = market.yesPrice >= 0.5 ? 'text-primary' : 'text-destructive';
          const changeText = market.yesPrice >= 0.5 ? 'YES' : 'NO';
          
          // Calculate days to expiry
          const daysToExpiry = market.endDate
            ? Math.max(0, Math.ceil((new Date(market.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null;

          return (
            <div
              key={market.id}
              className={`px-4 py-3 border-b border-border cursor-pointer transition-colors ${
                isActive ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-foreground/[0.02]'
              }`}
              onClick={() => onSelect(market)}
            >
              <div className="text-[11px] text-foreground mb-1.5 leading-[1.4] font-body font-medium line-clamp-2">
                {market.question}
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-[16px] font-bold ${priceColor}`}>
                  {(market.yesPrice * 100).toFixed(1)}¢
                </span>
                {daysToExpiry !== null && (
                  <span className="text-[9px] text-muted-foreground tracking-[1px]">
                    {daysToExpiry}D
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[9px] text-muted-foreground">
                  VOL: ${market.volume >= 1000000
                    ? (market.volume / 1000000).toFixed(1) + 'M'
                    : market.volume >= 1000
                      ? (market.volume / 1000).toFixed(0) + 'K'
                      : market.volume.toFixed(0)}
                </span>
                <span className={`text-[9px] px-1 rounded-sm ${
                  market.yesPrice >= 0.5
                    ? 'bg-primary/15 text-primary'
                    : 'bg-destructive/15 text-destructive'
                }`}>
                  {changeText} FAVORED
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
