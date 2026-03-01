import type { HardRule } from '@/lib/types';

interface RulesEngineProps {
  rules: HardRule[];
}

export function RulesEngine({ rules }: RulesEngineProps) {
  return (
    <div className="px-7 py-4 border-t border-border">
      <div className="text-[9px] tracking-[2px] text-muted-foreground mb-3">
        HARD RULES · CANNOT BE OVERRIDDEN
      </div>
      {rules.map((rule, i) => (
        <div
          key={i}
          className="flex justify-between items-center py-2 border-b border-foreground/[0.04] text-[11px]"
        >
          <span className="text-muted-foreground font-body">{rule.name}</span>
          <span className={`font-bold ${rule.violated ? 'text-destructive' : 'text-primary'}`}>
            {rule.value}
          </span>
        </div>
      ))}
    </div>
  );
}
