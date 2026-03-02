import type { HardRule } from '@/lib/types';

interface RulesEngineProps {
  rules: HardRule[];
}

export function RulesEngine({ rules }: RulesEngineProps) {
  return (
    <div className="px-5 py-3 border-t border-border">
      <div className="text-[8px] tracking-[2px] text-muted-foreground mb-2">
        HARD RULES · CANNOT BE OVERRIDDEN
      </div>
      {rules.map((rule, i) => (
        <div key={i} className="flex justify-between items-center py-1.5 border-b border-foreground/[0.04] text-[10px]">
          <span className="text-muted-foreground">{rule.name}</span>
          <span className={`font-bold ${rule.violated ? 'text-destructive' : 'text-primary'}`}>
            {rule.value}
          </span>
        </div>
      ))}
    </div>
  );
}
