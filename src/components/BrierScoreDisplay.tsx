import type { BrierState } from '@/lib/types';

interface BrierScoreDisplayProps {
  state: BrierState;
}

export function BrierScoreDisplay({ state }: BrierScoreDisplayProps) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-[24px] font-display text-primary">
        {state.score.toFixed(2)}
      </span>
      <div>
        <div className="text-[9px] text-muted-foreground tracking-[1px] leading-[1.4]">
          BRIER SCORE
          <br />
          CALIBRATION
        </div>
        <div className="text-[9px] mt-1 space-y-0.5">
          <div className="text-muted-foreground">
            EXCELLENT &lt;0.10
          </div>
          <div className="text-muted-foreground">
            GOOD &lt;0.20
          </div>
          <div className={`font-bold ${
            state.calibrationLabel === 'EXCELLENT' ? 'text-primary' :
            state.calibrationLabel === 'GOOD' ? 'text-primary' :
            state.calibrationLabel === 'FAIR' ? 'text-warning' :
            'text-destructive'
          }`}>
            YOU: {state.calibrationLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
