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
    <div className="flex gap-1 px-3 py-2 border-b border-border flex-wrap">
      {CRYPTO_FILTERS.map(f => {
        const isActive = activeFilter === f.keyword;
        const count = marketCounts[f.keyword] ?? 0;
        return (
          <button
            key={f.label}
            onClick={() => onFilterChange(f.keyword)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all ${
              isActive
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-secondary/50 text-muted-foreground border border-transparent hover:bg-secondary hover:text-foreground'
            }`}
          >
            {f.label}
            {f.keyword && count > 0 && (
              <span className="ml-1 text-[8px] opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { CRYPTO_FILTERS };
