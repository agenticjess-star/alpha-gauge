const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_PRICE = 'https://clob.polymarket.com/price';
const CLOB_PRICES_BATCH = 'https://clob.polymarket.com/prices';

/**
 * Polymarket Crypto Up/Down Discovery Engine v3
 * 
 * Slug conventions:
 *   5m:    {asset}-updown-5m-{epoch}        (epoch-based, deterministic)
 *   15m:   {asset}-updown-15m-{epoch}       (epoch-based, deterministic)
 *   4h:    {asset}-updown-4h-{epoch}        (epoch-based, deterministic)
 *   1h:    human-readable, e.g. "bitcoin-up-or-down-march-8-4am-et" (search-based)
 *   daily: human-readable, e.g. "bitcoin-up-or-down-on-march-8"    (search-based)
 */

// ─── Config ──────────────────────────────────────────────────

const EPOCH_INTERVALS: Record<string, number> = {
  '5m': 300,
  '15m': 900,
  '4h': 14400,
};

const SLUG_BASES: Record<string, Record<string, string>> = {
  btc: { '5m': 'btc-updown-5m', '15m': 'btc-updown-15m', '4h': 'btc-updown-4h' },
  eth: { '5m': 'eth-updown-5m', '15m': 'eth-updown-15m', '4h': 'eth-updown-4h' },
  sol: { '5m': 'sol-updown-5m', '15m': 'sol-updown-15m', '4h': 'sol-updown-4h' },
  xrp: { '5m': 'xrp-updown-5m', '15m': 'xrp-updown-15m', '4h': 'xrp-updown-4h' },
};

// Full asset names for human-readable slug search (1h, daily)
const ASSET_NAMES: Record<string, string[]> = {
  btc: ['bitcoin', 'btc'],
  eth: ['ethereum', 'eth'],
  sol: ['solana', 'sol'],
  xrp: ['xrp'],
};

// ─── Types ───────────────────────────────────────────────────

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

async function searchEvents(query: string, limit = 10): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      active: 'true',
      closed: 'false',
      order: 'endDate',
      ascending: 'true',
      title: query,
    });
    const res = await fetch(`${GAMMA_API}/events?${params}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
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

async function fetchBatchPrices(tokenIds: string[]): Promise<Record<string, number>> {
  if (tokenIds.length === 0) return {};
  try {
    const res = await fetch(CLOB_PRICES_BATCH, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_ids: tokenIds }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const result: Record<string, number> = {};
    if (typeof data === 'object' && data !== null) {
      for (const [id, val] of Object.entries(data)) {
        const p = typeof val === 'string' ? parseFloat(val) : (typeof val === 'object' && val !== null ? parseFloat((val as any).price ?? '0') : Number(val));
        if (!isNaN(p) && p > 0) result[id] = p;
      }
    }
    return result;
  } catch {
    return {};
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
    eventSlug: event.slug || event.ticker || '',
    eventTitle: event.title || '',
    endDate: event.endDate || event.end_date || '',
    markets,
    upPrice: prices.up,
    downPrice: prices.down,
    ...(resolved ? { resolved: true, outcome: determineOutcome(event) } : {}),
  };
}

// ─── Slug generation (epoch-based timeframes) ────────────────

function generateSlugs(base: string, interval: number, count: number, startEpoch: number): string[] {
  const currentWindow = Math.floor(startEpoch / interval) * interval;
  return Array.from({ length: count }, (_, i) => `${base}-${currentWindow + i * interval}`);
}

function generatePastSlugs(base: string, interval: number, count: number, startEpoch: number): string[] {
  const currentWindow = Math.floor(startEpoch / interval) * interval;
  return Array.from({ length: count }, (_, i) => `${base}-${currentWindow - (i + 1) * interval}`);
}

// ─── Epoch-based discovery (5m, 15m, 4h) ────────────────────

async function discoverEpochMarkets(
  asset: string, tf: string, includeHistory: boolean
): Promise<DiscoveredMarket[]> {
  const base = SLUG_BASES[asset]?.[tf];
  const interval = EPOCH_INTERVALS[tf];
  if (!base || !interval) return [];

  const nowSec = Math.floor(Date.now() / 1000);
  const results: DiscoveredMarket[] = [];

  // Current + next windows to find the active one
  const lookAhead = tf === '4h' ? 2 : 4;
  const upcomingSlugs = generateSlugs(base, interval, lookAhead, nowSec);
  const upcomingEvents = await Promise.all(upcomingSlugs.map(fetchEventBySlug));

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
  }

  if (includeHistory) {
    const twoDaysInWindows = Math.ceil((2 * 24 * 3600) / interval);
    const historyCount = Math.min(twoDaysInWindows, 20);
    const pastSlugs = generatePastSlugs(base, interval, historyCount, nowSec);

    for (let batch = 0; batch < pastSlugs.length; batch += 10) {
      const batchSlugs = pastSlugs.slice(batch, batch + 10);
      const events = await Promise.all(batchSlugs.map(fetchEventBySlug));
      for (const ev of events) {
        if (!ev) continue;
        results.push(eventToDiscoveredMarket(ev, asset, tf, { up: null, down: null }, true));
      }
    }
  }

  return results;
}

// ─── Search-based discovery (1h, daily) ──────────────────────

function isUpDownEvent(event: any, asset: string): boolean {
  const title = (event.title || '').toLowerCase();
  const slug = (event.slug || '').toLowerCase();
  const names = ASSET_NAMES[asset] || [];
  const hasAsset = names.some(n => title.includes(n) || slug.includes(n));
  const hasUpDown = title.includes('up or down') || title.includes('updown') || slug.includes('updown');
  return hasAsset && hasUpDown;
}

async function discoverSearchMarkets(
  asset: string, tf: string, includeHistory: boolean
): Promise<DiscoveredMarket[]> {
  const names = ASSET_NAMES[asset];
  if (!names || names.length === 0) return [];

  const results: DiscoveredMarket[] = [];
  const searchTerm = `${names[0]} up or down`;

  // Search for active events
  const events = await searchEvents(searchTerm, 20);

  const now = Date.now();

  for (const ev of events) {
    if (!isUpDownEvent(ev, asset)) continue;

    // Determine timeframe from slug/title
    const evTf = classifyTimeframe(ev);
    if (evTf !== tf) continue;

    const endTime = new Date(ev.endDate || '').getTime();
    const isResolved = ev.closed || endTime <= now;

    const firstMarket = ev.markets?.[0];
    let prices = { up: null as number | null, down: null as number | null };

    if (!isResolved && firstMarket) {
      prices = await getPrices(firstMarket);
    }

    results.push(eventToDiscoveredMarket(ev, asset, tf, prices, isResolved));
  }

  // Sort: active first (soonest end), then resolved (most recent)
  results.sort((a, b) => {
    const aResolved = !!a.resolved;
    const bResolved = !!b.resolved;
    if (aResolved !== bResolved) return aResolved ? 1 : -1;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });

  return results;
}

function classifyTimeframe(event: any): string {
  const slug = (event.slug || '').toLowerCase();
  const title = (event.title || '').toLowerCase();

  // Epoch-based slugs
  if (slug.match(/-5m-\d+$/)) return '5m';
  if (slug.match(/-15m-\d+$/)) return '15m';
  if (slug.match(/-4h-\d+$/)) return '4h';

  // 1h: title contains hour range like "4am-5am" or "4:00am-5:00am"
  // but NOT 4h range like "4am-8am"
  const hourMatch = title.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (hourMatch) {
    const startHour = parseInt(hourMatch[1]) + (hourMatch[3].toLowerCase() === 'pm' && hourMatch[1] !== '12' ? 12 : 0);
    const endHour = parseInt(hourMatch[4]) + (hourMatch[6].toLowerCase() === 'pm' && hourMatch[4] !== '12' ? 12 : 0);
    const diff = (endHour - startHour + 24) % 24;
    if (diff === 1) return '1h';
    if (diff === 4) return '4h';
  }

  // Daily: "on march 8" or "on march-8" pattern
  if (slug.match(/up-or-down-on-/) || title.match(/up or down on /i)) return 'daily';

  // Default: if no time range in title, likely daily
  if (!hourMatch && (title.includes('up or down') || slug.includes('updown'))) return 'daily';

  return 'unknown';
}

// ─── Main discovery router ───────────────────────────────────

async function discoverMarkets(
  asset: string, tf: string, includeHistory: boolean
): Promise<DiscoveredMarket[]> {
  if (tf in EPOCH_INTERVALS) {
    return discoverEpochMarkets(asset, tf, includeHistory);
  }
  if (tf === '1h' || tf === 'daily') {
    return discoverSearchMarkets(asset, tf, includeHistory);
  }
  return [];
}

// ─── HTTP handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const assetsParam = url.searchParams.get('assets') || 'btc,eth,sol,xrp';
    const timeframeParam = url.searchParams.get('timeframe') || '5m,15m,1h,4h,daily';
    const includeHistory = url.searchParams.get('history') !== 'false';

    const assets = assetsParam.split(',').map(s => s.trim().toLowerCase());
    const validTfs = ['5m', '15m', '1h', '4h', 'daily'];
    const timeframes = timeframeParam.split(',').map(s => s.trim().toLowerCase())
      .filter(tf => validTfs.includes(tf));

    if (timeframes.length === 0) timeframes.push('5m', '15m');

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
