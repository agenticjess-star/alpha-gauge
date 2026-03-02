import type { GovernanceState } from '@/lib/types';

interface GovernancePanelProps {
  governance: GovernanceState;
}

export function GovernancePanel({ governance }: GovernancePanelProps) {
  const progressPercent = Math.min(100, (governance.weeklyProgress / governance.weeklyTarget) * 100);

  return (
    <div className="overflow-y-auto scrollbar-thin">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
        <span className="text-[10px] tracking-[1.5px] text-muted-foreground uppercase font-medium">
          Governance
        </span>
      </div>

      {/* Critical Number */}
      <div className="p-4 border-b border-border">
        <div className="text-[9px] tracking-wide text-warning mb-1.5 font-mono">
          CRITICAL NUMBER · Q1 2026
        </div>
        <div className="font-display text-[32px] font-bold text-warning leading-none mb-1">
          ${governance.weeklyTarget}
        </div>
        <div className="text-[10px] text-muted-foreground">
          Weekly withdrawal target
        </div>
        <div className="mt-2.5 h-[3px] bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-warning rounded-full transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-muted-foreground font-mono">
            ${governance.weeklyProgress.toFixed(0)}
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">
            {progressPercent.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Decision Log */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between sticky top-[44px] bg-background z-10">
        <span className="text-[9px] tracking-wide text-muted-foreground font-mono">
          DECISION LOG
        </span>
        <span className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded-md font-mono">
          {governance.decisionLog.length}
        </span>
      </div>

      <div className="py-1">
        {governance.decisionLog.length === 0 && (
          <div className="px-4 py-6 text-[10px] text-muted-foreground text-center">
            No decisions logged yet.
          </div>
        )}
        {governance.decisionLog.map((entry) => (
          <div key={entry.id} className="px-4 py-2.5 border-b border-border/50 text-[10px]">
            <div className="text-[9px] text-muted-foreground font-mono mb-0.5">
              {new Date(entry.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false })}
            </div>
            <div className="text-foreground text-[11px] mb-0.5">
              <span className={
                entry.action === 'BUY' ? 'text-primary' :
                entry.action === 'EXIT' ? 'text-destructive' :
                'text-warning'
              }>
                {entry.action}
              </span>
              {' · '}{entry.market}
            </div>
            <div className="text-muted-foreground text-[10px]">
              {entry.reason}
            </div>
          </div>
        ))}
      </div>

      {/* Override */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4">
        <button className="w-full py-2 rounded-md bg-destructive/8 border border-destructive/20 text-destructive font-mono text-[10px] tracking-wide uppercase cursor-pointer transition-all hover:bg-destructive/15 active:scale-[0.98]">
          ⚠ OVERRIDE
        </button>
      </div>
    </div>
  );
}
