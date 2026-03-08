const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GAMMA_EVENTS = 'https://gamma-api.polymarket.com/events';
const CLOB_PRICE = 'https://clob.polymarket.com/price';

// Slug patterns used with slug_contains parameter for targeted queries
const SLUG_PATTERNS: Record<string, Record<string, string>> = {
  btc: { '5m': 'btc-updown-5m', '15m': 'btc-updown-15m', '1h': 'bitcoin-up-or-down' },
  eth: { '5m': 'eth-updown-5m', '15m': 'eth-updown-15m', '1h': 'ethereum-up-or-down' },
  sol: { '5m': 'sol-updown-5m', '15m': 'sol-updown-15m', '1h': 'solana-up-or-down' },
  xrp: { '5m': 'xrp-updown-5m', '15m': 'xrp-updown-15m', '1h': 'xrp-up-or-down' },
};

interface DiscoveredMarket {
  asset: string;
  timeframe: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  endDate: string;
  markets: {
    id: string;
    question: string;
    slug: string;
    outcomePrices: string;
    clobTokenIds: string;
    conditionId: string;
    active: boolean;
    closed: boolean;
    volume: string;
    liquidity: string;
  }[];
  upPrice: number | null;
  downPrice: number | null;
  resolved?: boolean;
  outcome?: string | null;
}

async function fetchClobPrice(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${CLOB_PRICE}?token_id=${tokenId}&side=BUY`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.price === 'string' ? parseFloat(data.price) : (data.price ?? null);
  } catch {
    return null;
  }
}

async function fetchEventsForSlug(
  slugContains: string,
  active: boolean,
  closed: boolean,
  limit: number
): Promise<any[]> {
  try {
    const url = `${GAMMA_EVENTS}?slug_contains=${encodeURIComponent(slugContains)}&active=${active}&closed=${closed}&limit=${limit}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function pickBestEvent(events: any[], futureOnly: boolean): any | null {
  if (events.length === 0) return null;
  const now = Date.now();

  // Sort by endDate — soonest future first
  events.sort((a, b) => {
    const aEnd = new Date(a.endDate || a.end_date || 0).getTime();
    const bEnd = new Date(b.endDate || b.end_date || 0).getTime();
    const aFuture = aEnd >= now;
    const bFuture = bEnd >= now;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    if (aFuture && bFuture) return aEnd - bEnd;
    return bEnd - aEnd;
  });

  if (futureOnly) {
    const future = events.find(e => new Date(e.endDate || e.end_date || 0).getTime() >= now);
    return future || null;
  }
  return events[0];
}

function extractMarketData(market: any) {
  return {
    id: market.id?.toString() || '',
    question: market.question || '',
    slug: market.slug || '',
    outcomePrices: market.outcomePrices || '',
    clobTokenIds: market.clobTokenIds || '',
    conditionId: market.conditionId || '',
    active: market.active ?? true,
    closed: market.closed ?? false,
    volume: market.volume || '0',
    liquidity: market.liquidity || '0',
  };
}

async function getPricesForMarket(market: any): Promise<{ up: number | null; down: number | null }> {
  let up: number | null = null;
  let down: number | null = null;

  try {
    const tokenIds = typeof market.clobTokenIds === 'string'
      ? JSON.parse(market.clobTokenIds)
      : market.clobTokenIds;
    if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
      [up, down] = await Promise.all([fetchClobPrice(tokenIds[0]), fetchClobPrice(tokenIds[1])]);
    }
  } catch { /* fallback */ }

  if (up === null && market.outcomePrices) {
    try {
      const prices = typeof market.outcomePrices === 'string'
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices;
      up = parseFloat(prices[0]) || null;
      down = parseFloat(prices[1]) || null;
    } catch { /* ignore */ }
  }

  return { up, down };
}

function determineOutcome(event: any): string | null {
  const markets = Array.isArray(event.markets) ? event.markets : [];
  if (markets.length === 0) return null;
  const m = markets[0];
  try {
    const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
    if (!Array.isArray(prices) || prices.length < 2) return null;
    const upPrice = parseFloat(prices[0]);
    const downPrice = parseFloat(prices[1]);
    if (upPrice > 0.9) return 'Up';
    if (downPrice > 0.9) return 'Down';
    return null;
  } catch {
    return null;
  }
}

async function discoverForAssetTimeframe(
  asset: string,
  tf: string,
  includeHistory: boolean
): Promise<DiscoveredMarket[]> {
  const slugPattern = SLUG_PATTERNS[asset]?.[tf];
  if (!slugPattern) return [];

  const results: DiscoveredMarket[] = [];

  // Fetch active (current/upcoming) markets
  const activeEvents = await fetchEventsForSlug(slugPattern, true, false, 10);
  console.log(`[${asset}/${tf}] ${activeEvents.length} active events found via slug_contains=${slugPattern}`);

  const best = pickBestEvent(activeEvents, true);
  if (best) {
    const markets = Array.isArray(best.markets) ? best.markets : [];
    const firstMarket = markets[0];
    const prices = firstMarket ? await getPricesForMarket(firstMarket) : { up: null, down: null };

    results.push({
      asset,
      timeframe: tf,
      eventId: best.id?.toString() || '',
      eventSlug: best.slug || '',
      eventTitle: best.title || '',
      endDate: best.endDate || best.end_date || '',
      markets: markets.map(extractMarketData),
      upPrice: prices.up,
      downPrice: prices.down,
    });
  }

  // Fetch resolved (historical) markets for lookback
  if (includeHistory) {
    const closedEvents = await fetchEventsForSlug(slugPattern, false, true, 20);
    const now = Date.now();
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

    const recentClosed = closedEvents.filter(ev => {
      const endTime = new Date(ev.endDate || ev.end_date || 0).getTime();
      return endTime >= twoDaysAgo;
    });

    console.log(`[${asset}/${tf}] ${recentClosed.length} resolved events in 2-day lookback`);

    for (const ev of recentClosed.slice(0, 10)) {
      const markets = Array.isArray(ev.markets) ? ev.markets : [];
      const outcome = determineOutcome(ev);

      results.push({
        asset,
        timeframe: tf,
        eventId: ev.id?.toString() || '',
        eventSlug: ev.slug || '',
        eventTitle: ev.title || '',
        endDate: ev.endDate || ev.end_date || '',
        markets: markets.map(extractMarketData),
        upPrice: null,
        downPrice: null,
        resolved: true,
        outcome,
      });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const assetsParam = url.searchParams.get('assets') || 'btc,eth,sol,xrp';
    const timeframeParam = url.searchParams.get('timeframe') || '5m,15m,1h';
    const includeHistory = url.searchParams.get('history') !== 'false';

    const assets = assetsParam.split(',').map(s => s.trim().toLowerCase());
    const timeframes = timeframeParam.split(',').map(s => s.trim().toLowerCase());

    // Run all asset/timeframe combos in parallel
    const promises: Promise<DiscoveredMarket[]>[] = [];
    for (const asset of assets) {
      for (const tf of timeframes) {
        promises.push(discoverForAssetTimeframe(asset, tf, includeHistory));
      }
    }

    const allResults = (await Promise.all(promises)).flat();

    return new Response(JSON.stringify(allResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
