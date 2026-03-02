import type { Market } from '@/lib/types';

const CRYPTO_FILTERS = [
  { label: 'ALL', keyword: '' },
  { label: 'BTC', keyword: 'bitcoin' },
  { label: 'ETH', keyword: 'ethereum' },
  { label: 'SOL', keyword: 'solana' },
  { label: 'XRP', keyword: 'xrp' },
] as const;

interface CryptoQuickSelectProps {
  activeFilter: string;
  onFilterChange: (keyword: string) => void;
  marketCounts: Record<string, number>;
}

export function CryptoQuickSelect({ activeFilter, onFilterChange, marketCounts }: CryptoQuickSelectProps) {
  return (
    <div className="flex gap-1.5 px-4 py-2.5 border-b border-border">
      {CRYPTO_FILTERS.map(f => {
        const isActive = activeFilter === f.keyword;
        const count = marketCounts[f.keyword] ?? 0;
        return (
          <button
            key={f.label}
            onClick={() => onFilterChange(f.keyword)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all ${
              isActive
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-secondary/50 text-muted-foreground border border-transparent hover:bg-secondary hover:text-foreground'
            }`}
          >
            {f.label}
            {f.keyword && count > 0 && (
              <span className="ml-1 text-[9px] opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { CRYPTO_FILTERS };
