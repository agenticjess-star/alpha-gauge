const TIMEFRAMES = ['5M', '15M', '1H', '4H', '1D'] as const;

interface TimeframeSelectorProps {
  active: string;
  onChange: (tf: string) => void;
}

export function TimeframeSelector({ active, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex gap-0.5 bg-secondary/30 rounded-md p-0.5">
      {TIMEFRAMES.map(tf => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all ${
            active === tf
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
