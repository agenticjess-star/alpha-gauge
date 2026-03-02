const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GAMMA_SEARCH = 'https://gamma-api.polymarket.com/public-search';
const GAMMA_EVENTS = 'https://gamma-api.polymarket.com/events';
const CLOB_PRICE = 'https://clob.polymarket.com/price';

// Slug patterns we look for in the /events endpoint
const SLUG_PATTERNS: Record<string, Record<string, string[]>> = {
  btc: {
    '5m': ['btc-updown-5m'],
    '15m': ['btc-updown-15m'],
    '1h': ['bitcoin-up-or-down'],
  },
  eth: {
    '5m': ['eth-updown-5m'],
    '15m': ['eth-updown-15m'],
    '1h': ['ethereum-up-or-down'],
  },
  sol: {
    '5m': ['sol-updown-5m'],
    '15m': ['sol-updown-15m'],
    '1h': ['solana-up-or-down'],
  },
  xrp: {
    '5m': ['xrp-updown-5m'],
    '15m': ['xrp-updown-15m'],
    '1h': ['xrp-up-or-down'],
  },
};

// Search queries for public-search endpoint
const SEARCH_QUERIES: Record<string, Record<string, string[]>> = {
  btc: {
    '5m': ['btc updown 5m'],
    '15m': ['btc updown 15m'],
    '1h': ['bitcoin up or down'],
  },
  eth: {
    '5m': ['eth updown 5m'],
    '15m': ['eth updown 15m'],
    '1h': ['ethereum up or down'],
  },
  sol: {
    '5m': ['sol updown 5m'],
    '15m': ['sol updown 15m'],
    '1h': ['solana up or down'],
  },
  xrp: {
    '5m': ['xrp updown 5m'],
    '15m': ['xrp updown 15m'],
    '1h': ['xrp up or down'],
  },
};

function identifyTimeframe(slug: string, title: string): string | null {
  const s = slug.toLowerCase();
  const t = title.toLowerCase();
  if (s.includes('updown-5m') || s.includes('-5m-') || t.includes('5 minute') || t.includes('5 min')) return '5m';
  if (s.includes('updown-15m') || s.includes('-15m-') || t.includes('15 minute') || t.includes('15 min')) return '15m';
  if ((s.includes('up-or-down') || t.includes('up or down')) && !s.includes('5m') && !s.includes('15m')) return '1h';
  return null;
}

function slugMatchesAsset(slug: string, asset: string): boolean {
  const s = slug.toLowerCase();
  const assetPatterns: Record<string, string[]> = {
    btc: ['btc', 'bitcoin'],
    eth: ['eth', 'ethereum'],
    sol: ['sol', 'solana'],
    xrp: ['xrp', 'ripple'],
  };
  return (assetPatterns[asset] || []).some(p => s.includes(p));
}

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

async function searchGamma(query: string): Promise<any[]> {
  try {
    const res = await fetch(`${GAMMA_SEARCH}?q=${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data?.events && Array.isArray(data.events)) return data.events;
    return [];
  } catch {
    return [];
  }
}

// Fetch from /events endpoint and filter by slug patterns
async function fetchEventsForPatterns(patterns: string[]): Promise<any[]> {
  try {
    const res = await fetch(
      `${GAMMA_EVENTS}?active=true&closed=false&limit=100`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) return [];
    const events = await res.json();
    if (!Array.isArray(events)) return [];
    // Filter events whose slug contains any of the patterns
    return events.filter((ev: any) => {
      const slug = (ev.slug || '').toLowerCase();
      return patterns.some(p => slug.includes(p));
    });
  } catch {
    return [];
  }
}

async function discoverForAsset(asset: string, timeframes: string[], eventsCache: any[] | null): Promise<DiscoveredMarket[]> {
  const results: DiscoveredMarket[] = [];
  const now = Date.now();

  for (const tf of timeframes) {
    // Strategy 1: Search via public-search
    const queries = SEARCH_QUERIES[asset]?.[tf] || [`${asset} updown ${tf}`];
    const searchResults = await Promise.all(queries.map(q => searchGamma(q)));
    const allEvents: any[] = searchResults.flat();

    // Strategy 2: Filter from cached /events endpoint
    const slugPatterns = SLUG_PATTERNS[asset]?.[tf] || [];
    if (eventsCache) {
      const fromEvents = eventsCache.filter((ev: any) => {
        const slug = (ev.slug || '').toLowerCase();
        return slugPatterns.some(p => slug.includes(p)) && slugMatchesAsset(slug, asset);
      });
      allEvents.push(...fromEvents);
    }

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = allEvents.filter(ev => {
      const id = ev.id?.toString();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Filter: active and not closed
    const active = unique.filter(ev => ev.active !== false && ev.closed !== true);

    // Match timeframe from slug/title
    const matching = active.filter(ev => {
      const detected = identifyTimeframe(ev.slug || '', ev.title || '');
      return detected === tf;
    });

    console.log(`[${asset}/${tf}] ${unique.length} unique, ${active.length} active, ${matching.length} matched`);

    if (matching.length === 0) continue;

    // Pick the soonest future endDate (currently active, not furthest out)
    matching.sort((a, b) => {
      const aEnd = new Date(a.endDate || a.end_date || 0).getTime();
      const bEnd = new Date(b.endDate || b.end_date || 0).getTime();
      // Prefer events ending soonest in the future
      const aFuture = aEnd >= now;
      const bFuture = bEnd >= now;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      if (aFuture && bFuture) return aEnd - bEnd; // soonest first
      return bEnd - aEnd; // both past: most recent first
    });

    const best = matching[0];
    const markets = Array.isArray(best.markets) ? best.markets : [];

    // Fetch CLOB prices
    let upPrice: number | null = null;
    let downPrice: number | null = null;

    if (markets.length > 0) {
      const market = markets[0];
      try {
        const tokenIds = typeof market.clobTokenIds === 'string'
          ? JSON.parse(market.clobTokenIds)
          : market.clobTokenIds;
        if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
          const [up, down] = await Promise.all([
            fetchClobPrice(tokenIds[0]),
            fetchClobPrice(tokenIds[1]),
          ]);
          upPrice = up;
          downPrice = down;
        }
      } catch { /* fallback below */ }

      if (upPrice === null && market.outcomePrices) {
        try {
          const prices = typeof market.outcomePrices === 'string'
            ? JSON.parse(market.outcomePrices)
            : market.outcomePrices;
          upPrice = parseFloat(prices[0]) || null;
          downPrice = parseFloat(prices[1]) || null;
        } catch { /* ignore */ }
      }
    }

    results.push({
      asset,
      timeframe: tf,
      eventId: best.id?.toString() || '',
      eventSlug: best.slug || '',
      eventTitle: best.title || '',
      endDate: best.endDate || best.end_date || '',
      markets: markets.map((m: any) => ({
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
      })),
      upPrice,
      downPrice,
    });
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

    const assets = assetsParam.split(',').map(s => s.trim().toLowerCase());
    const timeframes = timeframeParam.split(',').map(s => s.trim().toLowerCase());

    // Fetch the full active events list once (shared across all assets)
    let eventsCache: any[] | null = null;
    try {
      const res = await fetch(
        `${GAMMA_EVENTS}?active=true&closed=false&limit=100`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) eventsCache = data;
      }
    } catch { /* proceed without cache */ }

    console.log(`Events cache: ${eventsCache?.length ?? 0} events`);

    const promises = assets.map(a => discoverForAsset(a, timeframes, eventsCache));
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
