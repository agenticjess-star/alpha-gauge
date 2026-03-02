import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { ParticleFilterSnapshot } from '@/lib/types';

interface PriceChartProps {
  history: ParticleFilterSnapshot[];
  marketPrice: number;
  height?: number;
}

export function PriceChart({ history, marketPrice, height = 200 }: PriceChartProps) {
  const data = useMemo(() => {
    if (history.length === 0) {
      return [
        { t: 0, estimate: marketPrice * 100, market: marketPrice * 100, ciLow: marketPrice * 90, ciHigh: marketPrice * 110 },
      ];
    }
    return history.map((snap, i) => ({
      t: i,
      estimate: +(snap.estimate * 100).toFixed(2),
      market: +(snap.observation * 100).toFixed(2),
      ciLow: +(snap.ci[0] * 100).toFixed(2),
      ciHigh: +(snap.ci[1] * 100).toFixed(2),
    }));
  }, [history, marketPrice]);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradEstimate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(172, 66%, 50%)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(172, 66%, 50%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCI" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(172, 66%, 50%)" stopOpacity={0.08} />
              <stop offset="100%" stopColor="hsl(172, 66%, 50%)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 9, fill: 'hsl(215, 12%, 48%)' }}
            tickFormatter={(v: number) => `${v.toFixed(0)}¢`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(220, 18%, 6%)',
              border: '1px solid hsl(220, 14%, 14%)',
              borderRadius: '6px',
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
            }}
            labelStyle={{ display: 'none' }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}¢`,
              name === 'estimate' ? 'Filtered' : name === 'market' ? 'Market' : name,
            ]}
          />
          <Area
            type="monotone"
            dataKey="ciHigh"
            stroke="none"
            fill="url(#gradCI)"
            fillOpacity={1}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="estimate"
            stroke="hsl(172, 66%, 50%)"
            strokeWidth={2}
            fill="url(#gradEstimate)"
            fillOpacity={1}
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="market"
            stroke="hsl(215, 12%, 48%)"
            strokeWidth={1}
            strokeDasharray="4 3"
            fill="none"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
