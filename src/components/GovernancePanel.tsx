import type { GovernanceState, DecisionLogEntry } from '@/lib/types';
import { useState } from 'react';

interface GovernancePanelProps {
  governance: GovernanceState;
}

export function GovernancePanel({ governance }: GovernancePanelProps) {
  const progressPercent = Math.min(100, (governance.weeklyProgress / governance.weeklyTarget) * 100);

  return (
    <div className="overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
        <span className="text-[9px] tracking-[2px] text-muted-foreground uppercase">
          Chief of Staff
        </span>
        <span className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded-sm">
          GOVERNANCE
        </span>
      </div>

      {/* Critical Number */}
      <div className="p-4 border-b border-border bg-warning/[0.03]">
        <div className="text-[9px] tracking-[2px] text-warning mb-1.5 opacity-80">
          CRITICAL NUMBER · Q1 2026
        </div>
        <div className="font-display text-[36px] text-warning glow-warning-box leading-none mb-1">
          ${governance.weeklyTarget}
        </div>
        <div className="text-[10px] text-muted-foreground font-body">
          Weekly withdrawal target
        </div>
        <div className="mt-2.5 h-[3px] bg-secondary rounded-sm overflow-hidden">
          <div
            className="h-full bg-warning rounded-sm transition-all duration-1000"
            style={{ width: `${progressPercent}%`, boxShadow: '0 0 10px hsl(51 100% 50% / 0.4)' }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-muted-foreground">
            ${governance.weeklyProgress.toFixed(0)} this week
          </span>
          <span className="text-[9px] text-muted-foreground">
            {progressPercent.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Decision Log */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-[52px] bg-background z-10">
        <span className="text-[9px] tracking-[2px] text-muted-foreground">
          Decision Log
        </span>
        <span className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded-sm">
          {governance.decisionLog.length}
        </span>
      </div>

      <div className="py-2">
        {governance.decisionLog.length === 0 && (
          <div className="px-4 py-6 text-[10px] text-muted-foreground text-center">
            No decisions logged yet. Select a market to begin.
          </div>
        )}
        {governance.decisionLog.map((entry) => (
          <div key={entry.id} className="px-4 py-2.5 border-b border-border text-[10px] leading-[1.5]">
            <div className="text-[9px] text-muted-foreground tracking-[1px] mb-0.5">
              {new Date(entry.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false })}
            </div>
            <div className="text-foreground font-body text-[11px] mb-0.5">
              <span className={
                entry.action === 'BUY' ? 'text-primary' :
                entry.action === 'EXIT' ? 'text-destructive' :
                'text-warning'
              }>
                {entry.action}
              </span>
              {' · '}{entry.market}
            </div>
            <div className="text-muted-foreground font-body text-[10px]">
              {entry.reason}
            </div>
            {entry.pnl !== undefined && (
              <div className={`text-[10px] mt-0.5 font-bold ${entry.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Escape Hatch */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4">
        <button className="w-full py-2.5 bg-destructive/10 border border-destructive/30 text-destructive font-mono text-[10px] tracking-[2px] uppercase cursor-pointer transition-all hover:bg-destructive/20 hover:border-destructive active:scale-[0.98]">
          ⚠ OVERRIDE RULES — LOG REQUIRED
        </button>
      </div>
    </div>
  );
}
