import type { GovernanceState } from '@/lib/types';

interface GovernancePanelProps {
  governance: GovernanceState;
}

export function GovernancePanel({ governance }: GovernancePanelProps) {
  const progressPercent = Math.min(100, (governance.weeklyProgress / governance.weeklyTarget) * 100);

  return (
    <div className="overflow-y-auto overflow-x-hidden scrollbar-thin min-w-0">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
        <span className="text-[9px] tracking-[1.5px] text-muted-foreground uppercase font-medium">
          Governance
        </span>
      </div>

      {/* Critical Number */}
      <div className="p-3 border-b border-border">
        <div className="text-[8px] tracking-wide text-warning mb-1 font-mono">
          CRITICAL NUMBER · Q1 2026
        </div>
        <div className="font-display text-[26px] font-bold text-warning leading-none mb-0.5">
          ${governance.weeklyTarget}
        </div>
        <div className="text-[9px] text-muted-foreground">Weekly withdrawal target</div>
        <div className="mt-2 h-[2px] bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-warning rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-muted-foreground font-mono">${governance.weeklyProgress.toFixed(0)}</span>
          <span className="text-[8px] text-muted-foreground font-mono">{progressPercent.toFixed(0)}%</span>
        </div>
      </div>

      {/* Decision Log */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-[40px] bg-background z-10">
        <span className="text-[8px] tracking-wide text-muted-foreground font-mono">DECISION LOG</span>
        <span className="text-[8px] px-1 py-0.5 bg-secondary text-muted-foreground rounded font-mono">
          {governance.decisionLog.length}
        </span>
      </div>

      <div>
        {governance.decisionLog.length === 0 && (
          <div className="px-3 py-5 text-[9px] text-muted-foreground text-center">No decisions logged yet.</div>
        )}
        {governance.decisionLog.map((entry) => (
          <div key={entry.id} className="px-3 py-2 border-b border-border/50 text-[9px]">
            <div className="text-[8px] text-muted-foreground font-mono mb-0.5">
              {new Date(entry.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false })}
            </div>
            <div className="text-foreground text-[10px] mb-0.5">
              <span className={
                entry.action === 'BUY' ? 'text-primary' :
                entry.action === 'EXIT' ? 'text-destructive' :
                'text-warning'
              }>{entry.action}</span>
              {' · '}<span className="truncate">{entry.market}</span>
            </div>
            <div className="text-muted-foreground text-[9px] truncate">{entry.reason}</div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 bg-background border-t border-border p-3">
        <button className="w-full py-1.5 rounded bg-destructive/8 border border-destructive/20 text-destructive font-mono text-[9px] tracking-wide uppercase cursor-pointer transition-all hover:bg-destructive/15 active:scale-[0.98]">
          ⚠ OVERRIDE
        </button>
      </div>
    </div>
  );
}
