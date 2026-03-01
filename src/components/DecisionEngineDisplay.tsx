import type { Decision } from '@/lib/types';

interface DecisionEngineDisplayProps {
  decision: Decision;
}

export function DecisionEngineDisplay({ decision }: DecisionEngineDisplayProps) {
  const actionClass =
    decision.action === 'BUY' ? 'border-primary/40 bg-primary/[0.03]' :
    decision.action === 'EXIT' ? 'border-destructive/40 bg-destructive/[0.03]' :
    'border-warning/40 bg-warning/[0.03]';

  const actionColor =
    decision.action === 'BUY' ? 'text-primary' :
    decision.action === 'EXIT' ? 'text-destructive' :
    'text-warning';

  return (
    <div className={`border p-3.5 ${actionClass}`}>
      <div className={`font-display text-[28px] tracking-[2px] mb-1.5 ${actionColor}`}>
        {decision.action}
      </div>
      <div className="text-[11px] text-muted-foreground leading-[1.6] font-body mb-2.5">
        {decision.reason}
      </div>
      <div className="flex flex-col gap-1">
        {decision.conditions.map((c, i) => (
          <div
            key={i}
            className={`text-[10px] flex items-center gap-1.5 ${
              c.met ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              c.met ? 'bg-primary' : 'bg-destructive'
            }`} />
            {c.name}: {c.value}
          </div>
        ))}
      </div>
    </div>
  );
}
