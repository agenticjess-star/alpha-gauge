import { useState, useMemo } from 'react';
import type { Market } from '@/lib/types';
import { CryptoQuickSelect, CRYPTO_FILTERS } from './CryptoQuickSelect';

interface MarketsPanelProps {
  markets: Market[];
  selectedId: string | null;
  onSelect: (market: Market) => void;
  loading: boolean;
  error: string | null;
}

type ViewMode = 'list' | 'grid';

export function MarketsPanel({ markets, selectedId, onSelect, loading, error }: MarketsPanelProps) {
  const [cryptoFilter, setCryptoFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const marketCounts = useMemo(() => {
    const counts: Record<string, number> = { '': markets.length };
    for (const f of CRYPTO_FILTERS) {
      if (f.keyword) {
        counts[f.keyword] = markets.filter(m =>
          m.question.toLowerCase().includes(f.keyword) || m.slug?.toLowerCase().includes(f.keyword)
        ).length;
      }
    }
    return counts;
  }, [markets]);

  const filtered = useMemo(() => {
    if (!cryptoFilter) return markets;
    return markets.filter(m =>
      m.question.toLowerCase().includes(cryptoFilter) || m.slug?.toLowerCase().includes(cryptoFilter)
    );
  }, [markets, cryptoFilter]);

  return (
    <div className="border-r border-border overflow-y-auto scrollbar-thin flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
        <span className="text-[10px] tracking-[1.5px] text-muted-foreground uppercase font-medium">
          Markets
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded-md font-mono">
            {filtered.length}
          </span>
          <div className="flex bg-secondary/50 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-1.5 py-0.5 text-[9px] transition-colors ${viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              ≡
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-1.5 py-0.5 text-[9px] transition-colors ${viewMode === 'grid' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              ⊞
            </button>
          </div>
        </div>
      </div>

      <CryptoQuickSelect
        activeFilter={cryptoFilter}
        onFilterChange={setCryptoFilter}
        marketCounts={marketCounts}
      />

      {loading && (
        <div className="p-4 text-[10px] text-muted-foreground tracking-[1px] animate-pulse-live font-mono">
          CONNECTING...
        </div>
      )}

      {error && (
        <div className="p-4 text-[10px] text-destructive font-mono">
          {error}
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="py-1 flex-1">
          {filtered.map((market) => (
            <MarketListItem
              key={market.id}
              market={market}
              isActive={market.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="p-2 grid grid-cols-2 gap-1.5 flex-1">
          {filtered.map((market) => (
            <MarketGridItem
              key={market.id}
              market={market}
              isActive={market.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketListItem({ market, isActive, onSelect }: { market: Market; isActive: boolean; onSelect: (m: Market) => void }) {
  const priceColor = market.yesPrice >= 0.5 ? 'text-chart-up' : 'text-destructive';
  const daysToExpiry = market.endDate
    ? Math.max(0, Math.ceil((new Date(market.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const polymarketUrl = `https://polymarket.com/event/${market.slug}`;

  return (
    <div
      className={`px-4 py-2.5 border-b border-border/50 cursor-pointer transition-all ${
        isActive ? 'bg-primary/[0.06] border-l-2 border-l-primary' : 'hover:bg-accent/50'
      }`}
      onClick={() => onSelect(market)}
    >
      <div className="text-[11px] text-foreground mb-1.5 leading-[1.4] font-medium line-clamp-2">
        {market.question}
      </div>
      <div className="flex justify-between items-center">
        <span className={`text-[15px] font-display font-bold ${priceColor}`}>
          {(market.yesPrice * 100).toFixed(1)}¢
        </span>
        <div className="flex items-center gap-2">
          {daysToExpiry !== null && (
            <span className="text-[9px] text-muted-foreground font-mono">
              {daysToExpiry}D
            </span>
          )}
          <a
            href={polymarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[9px] text-muted-foreground hover:text-primary transition-colors"
            title="Open on Polymarket"
          >
            ↗
          </a>
        </div>
      </div>
      <div className="flex justify-between items-center mt-1">
        <span className="text-[9px] text-muted-foreground font-mono">
          VOL ${market.volume >= 1000000
            ? (market.volume / 1000000).toFixed(1) + 'M'
            : market.volume >= 1000
              ? (market.volume / 1000).toFixed(0) + 'K'
              : market.volume.toFixed(0)}
        </span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono ${
          market.yesPrice >= 0.5
            ? 'bg-primary/10 text-primary'
            : 'bg-destructive/10 text-destructive'
        }`}>
          {market.yesPrice >= 0.5 ? 'YES' : 'NO'}
        </span>
      </div>
    </div>
  );
}

function MarketGridItem({ market, isActive, onSelect }: { market: Market; isActive: boolean; onSelect: (m: Market) => void }) {
  const priceColor = market.yesPrice >= 0.5 ? 'text-chart-up' : 'text-destructive';
  const polymarketUrl = `https://polymarket.com/event/${market.slug}`;

  return (
    <div
      className={`p-2.5 rounded-md border cursor-pointer transition-all ${
        isActive ? 'bg-primary/[0.06] border-primary/30' : 'border-border/50 hover:border-border hover:bg-accent/30'
      }`}
      onClick={() => onSelect(market)}
    >
      <div className="text-[10px] text-foreground leading-[1.3] font-medium line-clamp-2 mb-2 min-h-[26px]">
        {market.question}
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-[16px] font-display font-bold ${priceColor}`}>
          {(market.yesPrice * 100).toFixed(0)}¢
        </span>
        <a
          href={polymarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-[9px] text-muted-foreground hover:text-primary"
        >
          ↗
        </a>
      </div>
      <div className="text-[9px] text-muted-foreground font-mono mt-1">
        ${market.volume >= 1000000 ? (market.volume / 1000000).toFixed(1) + 'M' : (market.volume / 1000).toFixed(0) + 'K'}
      </div>
    </div>
  );
}
