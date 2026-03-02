const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GAMMA_SEARCH = 'https://gamma-api.polymarket.com/public-search'; // uses ?q= param
const GAMMA_EVENTS = 'https://gamma-api.polymarket.com/events';
const CLOB_PRICE = 'https://clob.polymarket.com/price';

// Asset search queries for up/down markets
const ASSET_QUERIES: Record<string, string[]> = {
  btc: ['btc updown', 'bitcoin up or down'],
  eth: ['eth updown', 'ethereum up or down'],
  sol: ['sol updown', 'solana up or down'],
  xrp: ['xrp updown'],
};

// Timeframe identifiers in event titles/slugs
const TIMEFRAME_PATTERNS: Record<string, { slugParts: string[]; titleParts: string[] }> = {
  '5m': { slugParts: ['5m', '5-m'], titleParts: ['5 minute', '5 min', '5m'] },
  '15m': { slugParts: ['15m', '15-m'], titleParts: ['15 minute', '15 min', '15m'] },
  '1h': { slugParts: ['1h', '1-h', '1hr'], titleParts: ['1 hour', '1hr', '1h'] },
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
}

function matchesTimeframe(slug: string, title: string, tf: string): boolean {
  const pattern = TIMEFRAME_PATTERNS[tf];
  if (!pattern) return false;
  const s = slug.toLowerCase();
  const t = title.toLowerCase();
  return pattern.slugParts.some(p => s.includes(p)) || pattern.titleParts.some(p => t.includes(p));
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

async function discoverForAsset(asset: string, timeframes: string[]): Promise<DiscoveredMarket[]> {
  const queries = ASSET_QUERIES[asset] || [`${asset} updown`];
  const allEvents: any[] = [];

  // Try each search query
  for (const query of queries) {
    try {
      const res = await fetch(`${GAMMA_SEARCH}?query=${encodeURIComponent(query)}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        // public-search returns an array of events
        if (Array.isArray(data)) {
          allEvents.push(...data);
        }
      }
    } catch {
      // continue
    }
  }

  // Also try the events endpoint with tag-based filtering
  try {
    const res = await fetch(`${GAMMA_EVENTS}?active=true&closed=false&limit=50`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const events = await res.json();
      if (Array.isArray(events)) {
        for (const ev of events) {
          const slug = (ev.slug || '').toLowerCase();
          const title = (ev.title || '').toLowerCase();
          if (slug.includes(asset) && (slug.includes('updown') || slug.includes('up-or-down') || title.includes('up or down'))) {
            allEvents.push(ev);
          }
        }
      }
    }
  } catch {
    // continue
  }

  // Deduplicate by event id
  const seen = new Set<string>();
  const unique = allEvents.filter(ev => {
    if (!ev.id || seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });

  // Filter: active, not closed
  const active = unique.filter(ev => ev.active !== false && ev.closed !== true);

  const results: DiscoveredMarket[] = [];

  for (const tf of timeframes) {
    // Find events matching this timeframe
    const matching = active.filter(ev =>
      matchesTimeframe(ev.slug || '', ev.title || '', tf)
    );

    if (matching.length === 0) continue;

    // Pick the one with the latest endDate (most current)
    matching.sort((a, b) => {
      const aEnd = new Date(a.endDate || a.end_date || 0).getTime();
      const bEnd = new Date(b.endDate || b.end_date || 0).getTime();
      return bEnd - aEnd;
    });

    const best = matching[0];
    const markets = Array.isArray(best.markets) ? best.markets : [];

    // Try to get CLOB prices for the first market's tokens
    let upPrice: number | null = null;
    let downPrice: number | null = null;

    if (markets.length > 0) {
      const market = markets[0];
      try {
        const tokenIds = typeof market.clobTokenIds === 'string'
          ? JSON.parse(market.clobTokenIds)
          : market.clobTokenIds;
        if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
          // Token 0 = Yes/Up, Token 1 = No/Down
          const [up, down] = await Promise.all([
            fetchClobPrice(tokenIds[0]),
            fetchClobPrice(tokenIds[1]),
          ]);
          upPrice = up;
          downPrice = down;
        }
      } catch {
        // fallback to outcomePrices
      }

      // Fallback to outcomePrices if CLOB didn't work
      if (upPrice === null && market.outcomePrices) {
        try {
          const prices = typeof market.outcomePrices === 'string'
            ? JSON.parse(market.outcomePrices)
            : market.outcomePrices;
          upPrice = parseFloat(prices[0]) || null;
          downPrice = parseFloat(prices[1]) || null;
        } catch {
          // ignore
        }
      }
    }

    results.push({
      asset,
      timeframe: tf,
      eventId: best.id,
      eventSlug: best.slug,
      eventTitle: best.title || '',
      endDate: best.endDate || best.end_date || '',
      markets: markets.map((m: any) => ({
        id: m.id,
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
    const asset = (url.searchParams.get('asset') || '').toLowerCase();
    const timeframe = url.searchParams.get('timeframe') || '';
    const assetsParam = url.searchParams.get('assets') || '';

    // Mode 1: discover all assets + all timeframes
    if (assetsParam || (!asset && !timeframe)) {
      const assets = assetsParam ? assetsParam.split(',') : ['btc', 'eth', 'sol', 'xrp'];
      const tfs = timeframe ? timeframe.split(',') : ['5m', '15m', '1h'];

      const allResults: DiscoveredMarket[] = [];
      // Process assets in parallel
      const promises = assets.map(a => discoverForAsset(a.trim(), tfs));
      const results = await Promise.all(promises);
      for (const r of results) allResults.push(...r);

      return new Response(JSON.stringify(allResults), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode 2: discover single asset
    const tfs = timeframe ? timeframe.split(',') : ['5m', '15m', '1h'];
    const results = await discoverForAsset(asset, tfs);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
