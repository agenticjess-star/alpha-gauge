interface MonteCarloGridProps {
  samples: boolean[];
}

export function MonteCarloGrid({ samples }: MonteCarloGridProps) {
  // Pad to 100 if needed
  const cells = samples.slice(0, 100);
  while (cells.length < 100) cells.push(false);

  return (
    <div className="grid grid-cols-[repeat(20,1fr)] gap-px">
      {cells.map((hit, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-sm transition-colors ${
            hit
              ? 'bg-primary opacity-70'
              : 'bg-destructive opacity-30'
          }`}
        />
      ))}
    </div>
  );
}
