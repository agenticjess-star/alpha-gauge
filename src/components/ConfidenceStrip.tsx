interface ConfidenceStripProps {
  ci: [number, number];
  estimate: number;
}

export function ConfidenceStrip({ ci, estimate }: ConfidenceStripProps) {
  const width = ci[1] - ci[0];
  const segments = 20;

  return (
    <div className="flex h-1 gap-px mb-3">
      {Array.from({ length: segments }, (_, i) => {
        const pos = i / segments;
        const inRange = pos >= ci[0] && pos <= ci[1];
        const nearCenter = Math.abs(pos - estimate) < 0.05;

        let className = 'flex-1 rounded-sm ';
        if (nearCenter) className += 'bg-primary';
        else if (inRange && width < 0.15) className += 'bg-primary';
        else if (inRange) className += 'bg-warning';
        else className += 'bg-secondary';

        return <div key={i} className={className} />;
      })}
    </div>
  );
}
