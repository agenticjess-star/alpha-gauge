import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { PricePoint } from '@/hooks/usePriceHistory';

interface SpotPriceChartProps {
  history: PricePoint[];
  height?: number;
  priceToBeat?: number | null;
}

export function SpotPriceChart({ history, height = 320, priceToBeat }: SpotPriceChartProps) {
  const data = useMemo(() => {
    if (history.length === 0) return [];
    return history.map((p, i) => ({
      idx: i,
      price: p.price,
      time: p.time,
    }));
  }, [history]);

  const { min, max } = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 100 };
    const prices = data.map(d => d.price);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const pad = (hi - lo) * 0.15 || hi * 0.002;
    return { min: lo - pad, max: hi + pad };
  }, [data]);

  const lastPrice = data.length > 0 ? data[data.length - 1].price : null;
  const firstPrice = data.length > 0 ? data[0].price : null;
  const isUp = lastPrice !== null && firstPrice !== null && lastPrice >= firstPrice;

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="text-[10px] text-muted-foreground font-mono animate-pulse-live">
          WAITING FOR PRICE DATA...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spotGradUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(152, 60%, 48%)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(152, 60%, 48%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="spotGradDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(0, 72%, 56%)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(0, 72%, 56%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="idx" hide />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 9, fill: 'hsl(215, 12%, 48%)' }}
            tickFormatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            axisLine={false}
            tickLine={false}
            width={65}
          />
          {priceToBeat != null && (
            <Tooltip
              contentStyle={{
                background: 'hsl(220, 18%, 6%)',
                border: '1px solid hsl(220, 14%, 14%)',
                borderRadius: '6px',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
              }}
              labelStyle={{ display: 'none' }}
              formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
            />
          )}
          {!priceToBeat && (
            <Tooltip
              contentStyle={{
                background: 'hsl(220, 18%, 6%)',
                border: '1px solid hsl(220, 14%, 14%)',
                borderRadius: '6px',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
              }}
              labelStyle={{ display: 'none' }}
              formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
            />
          )}
          {/* Price to beat reference line */}
          {priceToBeat != null && priceToBeat >= min && priceToBeat <= max && (
            <Area
              type="monotone"
              dataKey={() => priceToBeat}
              stroke="hsl(215, 12%, 30%)"
              strokeWidth={1}
              strokeDasharray="6 4"
              fill="none"
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke={isUp ? 'hsl(152, 60%, 48%)' : 'hsl(0, 72%, 56%)'}
            strokeWidth={2}
            fill={isUp ? 'url(#spotGradUp)' : 'url(#spotGradDown)'}
            fillOpacity={1}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
