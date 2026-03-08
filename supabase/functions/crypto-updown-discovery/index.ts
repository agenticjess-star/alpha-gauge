const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_PRICE = 'https://clob.polymarket.com/price';

/**
 * Polymarket Crypto Up/Down Discovery Engine
 * 
 * Slug convention (discovered empirically):
 *   5m:  {asset}-updown-5m-{floor(epoch/300)*300}
 *   15m: {asset}-updown-15m-{floor(epoch/900)*900}
 * 
 * 1h markets do NOT currently exist on Polymarket.
 * Only 5m and 15m series are active as of March 2026.
 * 
 * Discovery uses the direct path endpoint:
 *   GET /events/slug/{exact-slug}
 * which is deterministic and avoids unreliable search.
 */

// Interval sizes in seconds
const INTERVALS: Record<string, number> = { '5m': 300, '15m': 900 };

// Slug base patterns per asset/timeframe
const SLUG_BASES: Record<string, Record<string, string>> = {
  btc: { '5m': 'btc-updown-5m', '15m': 'btc-updown-15m' },
  eth: { '5m': 'eth-updown-5m', '15m': 'eth-updown-15m' },
  sol: { '5m': 'sol-updown-5m', '15m': 'sol-updown-15m' },
  xrp: { '5m': 'xrp-updown-5m', '15m': 'xrp-updown-15m' },
};

interface DiscoveredMarket {
  asset: string;
  timeframe: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  endDate: string;
  markets: MarketData[];
  upPrice: number | null;
  downPrice: number | null;
  resolved?: boolean;
  outcome?: string | null;
}

interface MarketData {
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
}

// ─── Gamma API helpers ───────────────────────────────────────

async function fetchEventBySlug(slug: string): Promise<any | null> {
  try {
    const res = await fetch(`${GAMMA_API}/events/slug/${slug}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ? data : null;
  } catch {
    return null;
  }
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

// ─── Data extraction ─────────────────────────────────────────

function extractMarket(m: any): MarketData {
  return {
    id: m.id?.toString() || '',
    question: m.question || '',
    slug: m.slug || '',
    outcomePrices: m.outcomePrices || '',
    clobTokenIds: m.clobTokenIds || '',
    conditionId: m.conditionId || '',
    active: m.active ?? true,
    closed: m.closed ?? false,
    volume: m.volume || '0',
    liquidity: m.liquidity || '0',
  };
}

async function getPrices(market: any): Promise<{ up: number | null; down: number | null }> {
  // Try CLOB first (real-time)
  try {
    const tokenIds = typeof market.clobTokenIds === 'string'
      ? JSON.parse(market.clobTokenIds) : market.clobTokenIds;
    if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
      const [up, down] = await Promise.all([
        fetchClobPrice(tokenIds[0]),
        fetchClobPrice(tokenIds[1]),
      ]);
      return { up, down };
    }
  } catch { /* fallback */ }

  // Fallback to cached outcomePrices
  try {
    const prices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices) : market.outcomePrices;
    return {
      up: parseFloat(prices[0]) || null,
      down: parseFloat(prices[1]) || null,
    };
  } catch {
    return { up: null, down: null };
  }
}

function determineOutcome(event: any): string | null {
  const m = event.markets?.[0];
  if (!m) return null;
  try {
    const prices = typeof m.outcomePrices === 'string'
      ? JSON.parse(m.outcomePrices) : m.outcomePrices;
    if (parseFloat(prices[0]) > 0.9) return 'Up';
    if (parseFloat(prices[1]) > 0.9) return 'Down';
  } catch {}
  return null;
}

function eventToDiscoveredMarket(
  event: any, asset: string, tf: string, prices: { up: number | null; down: number | null },
  resolved = false
): DiscoveredMarket {
  const markets = Array.isArray(event.markets) ? event.markets.map(extractMarket) : [];
  return {
    asset, timeframe: tf,
    eventId: event.id?.toString() || '',
    eventSlug: event.slug || '',
    eventTitle: event.title || '',
    endDate: event.endDate || event.end_date || '',
    markets,
    upPrice: prices.up,
    downPrice: prices.down,
    ...(resolved ? { resolved: true, outcome: determineOutcome(event) } : {}),
  };
}

// ─── Slug generation ─────────────────────────────────────────

function generateSlugs(base: string, interval: number, count: number, startEpoch: number): string[] {
  const currentWindow = Math.floor(startEpoch / interval) * interval;
  return Array.from({ length: count }, (_, i) => `${base}-${currentWindow + i * interval}`);
}

function generatePastSlugs(base: string, interval: number, count: number, startEpoch: number): string[] {
  const currentWindow = Math.floor(startEpoch / interval) * interval;
  return Array.from({ length: count }, (_, i) => `${base}-${currentWindow - (i + 1) * interval}`);
}

// ─── Discovery ───────────────────────────────────────────────

async function discoverMarkets(
  asset: string, tf: string, includeHistory: boolean
): Promise<DiscoveredMarket[]> {
  const base = SLUG_BASES[asset]?.[tf];
  const interval = INTERVALS[tf];
  if (!base || !interval) return [];

  const nowSec = Math.floor(Date.now() / 1000);
  const results: DiscoveredMarket[] = [];

  // Current + next 3 windows (to find the active one)
  const upcomingSlugs = generateSlugs(base, interval, 4, nowSec);
  const upcomingEvents = await Promise.all(upcomingSlugs.map(fetchEventBySlug));

  // Find the best active event (soonest endDate in the future)
  const now = Date.now();
  let bestActive: { event: any; slug: string } | null = null;

  for (let i = 0; i < upcomingEvents.length; i++) {
    const ev = upcomingEvents[i];
    if (!ev) continue;
    const endTime = new Date(ev.endDate || '').getTime();
    if (endTime > now && !ev.closed) {
      if (!bestActive || endTime < new Date(bestActive.event.endDate).getTime()) {
        bestActive = { event: ev, slug: upcomingSlugs[i] };
      }
    }
  }

  if (bestActive) {
    const firstMarket = bestActive.event.markets?.[0];
    const prices = firstMarket ? await getPrices(firstMarket) : { up: null, down: null };
    results.push(eventToDiscoveredMarket(bestActive.event, asset, tf, prices));
    console.log(`[${asset}/${tf}] Active: ${bestActive.slug} ends ${bestActive.event.endDate}`);
  } else {
    console.log(`[${asset}/${tf}] No active event found in upcoming windows`);
  }

  // History: past events (up to 20 most recent within 2 days)
  if (includeHistory) {
    const twoDaysInWindows = Math.ceil((2 * 24 * 3600) / interval);
    const historyCount = Math.min(twoDaysInWindows, 20);
    const pastSlugs = generatePastSlugs(base, interval, historyCount, nowSec);

    // Fetch in parallel batches of 10
    for (let batch = 0; batch < pastSlugs.length; batch += 10) {
      const batchSlugs = pastSlugs.slice(batch, batch + 10);
      const events = await Promise.all(batchSlugs.map(fetchEventBySlug));
      for (const ev of events) {
        if (!ev) continue;
        results.push(eventToDiscoveredMarket(ev, asset, tf, { up: null, down: null }, true));
      }
    }

    console.log(`[${asset}/${tf}] ${results.length - (bestActive ? 1 : 0)} historical events`);
  }

  return results;
}

// ─── HTTP handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const assetsParam = url.searchParams.get('assets') || 'btc,eth,sol,xrp';
    const timeframeParam = url.searchParams.get('timeframe') || '5m,15m';
    const includeHistory = url.searchParams.get('history') !== 'false';

    const assets = assetsParam.split(',').map(s => s.trim().toLowerCase());
    const timeframes = timeframeParam.split(',').map(s => s.trim().toLowerCase())
      .filter(tf => tf === '5m' || tf === '15m'); // Only supported timeframes

    if (timeframes.length === 0) {
      timeframes.push('5m', '15m');
    }

    // Run all discoveries in parallel
    const promises: Promise<DiscoveredMarket[]>[] = [];
    for (const asset of assets) {
      for (const tf of timeframes) {
        promises.push(discoverMarkets(asset, tf, includeHistory));
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
