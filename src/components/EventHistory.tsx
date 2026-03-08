import { useMemo } from 'react';
import type { UpDownMarket } from '@/lib/updownTypes';

interface EventHistoryProps {
  allMarkets: UpDownMarket[];
  activeMarketId: string | null;
}

export function EventHistory({ allMarkets, activeMarketId }: EventHistoryProps) {
  const { expired, upcoming } = useMemo(() => {
    const now = Date.now();
    const exp: UpDownMarket[] = [];
    const up: UpDownMarket[] = [];

    for (const m of allMarkets) {
      if (m.resolved) {
        exp.push(m);
      } else if (m.endDate) {
        const end = new Date(m.endDate).getTime();
        if (end <= now) {
          exp.push(m);
        } else {
          up.push(m);
        }
      }
    }

    // Sort expired: most recent first
    exp.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
    // Sort upcoming: soonest first
    up.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

    return { expired: exp, upcoming: up };
  }, [allMarkets]);

  return (
    <div className="flex flex-col min-w-0">
      {/* Active / Upcoming */}
      {upcoming.length > 0 && (
        <>
          <div className="px-3 py-1.5 border-b border-border sticky top-0 bg-background z-10">
            <span className="text-[8px] tracking-[1.5px] text-primary font-mono uppercase">
              UPCOMING · {upcoming.length}
            </span>
          </div>
          {upcoming.map((m) => (
            <EventRow
              key={m.eventId}
              market={m}
              isActive={m.eventId === activeMarketId}
              status="upcoming"
            />
          ))}
        </>
      )}

      {/* Expired / Resolved */}
      {expired.length > 0 && (
        <>
          <div className="px-3 py-1.5 border-b border-border sticky top-[28px] bg-background z-10">
            <span className="text-[8px] tracking-[1.5px] text-muted-foreground font-mono uppercase">
              RESOLVED · {expired.length}
            </span>
          </div>
          {expired.map((m) => (
            <EventRow
              key={m.eventId}
              market={m}
              isActive={false}
              status="resolved"
            />
          ))}
        </>
      )}

      {upcoming.length === 0 && expired.length === 0 && (
        <div className="px-3 py-8 text-center">
          <span className="text-[9px] text-muted-foreground font-mono">
            NO EVENTS DISCOVERED
          </span>
        </div>
      )}
    </div>
  );
}

function EventRow({
  market,
  isActive,
  status,
}: {
  market: UpDownMarket;
  isActive: boolean;
  status: 'upcoming' | 'resolved';
}) {
  const upPct = market.upPrice !== null ? (market.upPrice * 100).toFixed(0) : '—';
  const downPct = market.downPrice !== null ? (market.downPrice * 100).toFixed(0) : '—';

  const timeLabel = market.endDate ? getRelativeTime(market.endDate) : '';

  // Determine outcome for resolved markets
  const resolved = status === 'resolved' || !!market.resolved;
  const upWon = resolved && (market.outcome === 'Up' || (market.upPrice !== null && market.upPrice > 0.9));
  const downWon = resolved && (market.outcome === 'Down' || (market.downPrice !== null && market.downPrice > 0.9));

  return (
    <div
      className={`px-3 py-2 border-b border-border/50 transition-all ${
        isActive
          ? 'bg-primary/[0.06] border-l-2 border-l-primary'
          : resolved
          ? 'opacity-60'
          : 'hover:bg-accent/30'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] font-mono text-muted-foreground uppercase">
          {market.asset.toUpperCase()} · {market.timeframe}
        </span>
        <span className="text-[8px] font-mono text-muted-foreground">{timeLabel}</span>
      </div>
      <div className="text-[9px] text-foreground leading-[1.3] line-clamp-1 mb-1">
        {market.eventTitle}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-mono font-medium ${
          upWon ? 'text-chart-up' : 'text-muted-foreground'
        }`}>
          ↑{upPct}¢
        </span>
        <span className={`text-[10px] font-mono font-medium ${
          downWon ? 'text-destructive' : 'text-muted-foreground'
        }`}>
          ↓{downPct}¢
        </span>
        {resolved && (upWon || downWon) && (
          <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${
            upWon ? 'bg-chart-up/15 text-chart-up' : 'bg-destructive/15 text-destructive'
          }`}>
            {upWon ? 'UP ✓' : 'DOWN ✓'}
          </span>
        )}
        <a
          href={`https://polymarket.com/event/${market.eventSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-[8px] text-muted-foreground hover:text-primary transition-colors ml-auto"
        >↗</a>
      </div>
    </div>
  );
}

function getRelativeTime(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) {
    const ago = Math.abs(diff);
    const mins = Math.floor(ago / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `in ${hrs}h`;
}
