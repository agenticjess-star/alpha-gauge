const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GAMMA_SEARCH = 'https://gamma-api.polymarket.com/public-search';
const GAMMA_EVENTS = 'https://gamma-api.polymarket.com/events';
const CLOB_PRICE = 'https://clob.polymarket.com/price';

// Search queries per asset + timeframe — these map to how Polymarket names their events
const SEARCH_QUERIES: Record<string, Record<string, string[]>> = {
  btc: {
    '5m': ['btc updown 5m', 'bitcoin 5 minutes'],
    '15m': ['btc updown 15m', 'bitcoin 15 minutes'],
    '1h': ['bitcoin up or down'],
  },
  eth: {
    '5m': ['eth updown 5m', 'ethereum 5 minutes'],
    '15m': ['eth updown 15m', 'ethereum 15 minutes'],
    '1h': ['ethereum up or down'],
  },
  sol: {
    '5m': ['sol updown 5m', 'solana 5 minutes'],
    '15m': ['sol updown 15m', 'solana 15 minutes'],
    '1h': ['solana up or down'],
  },
  xrp: {
    '5m': ['xrp updown 5m'],
    '15m': ['xrp updown 15m'],
    '1h': ['xrp up or down'],
  },
};

// Slug patterns for timeframe identification
function identifyTimeframe(slug: string, title: string): string | null {
  const s = slug.toLowerCase();
  const t = title.toLowerCase();
  
  // 5m: slug contains "updown-5m" or "-5m-" or title contains "5 minute"
  if (s.includes('updown-5m') || s.includes('-5m-') || t.includes('5 minute') || t.includes('5 min')) return '5m';
  
  // 15m: slug contains "updown-15m" or "-15m-" or title contains "15 minute"  
  if (s.includes('updown-15m') || s.includes('-15m-') || t.includes('15 minute') || t.includes('15 min')) return '15m';
  
  // 1h: slug contains "up-or-down" without 5m/15m, or title matches hourly pattern like "March 2, 4PM ET"
  // Hourly events have titles like "Bitcoin Up or Down - March 2, 4PM ET"
  if ((s.includes('up-or-down') || t.includes('up or down')) && !s.includes('5m') && !s.includes('15m')) return '1h';
  
  return null;
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

async function discoverForAsset(asset: string, timeframes: string[]): Promise<DiscoveredMarket[]> {
  const results: DiscoveredMarket[] = [];

  for (const tf of timeframes) {
    const queries = SEARCH_QUERIES[asset]?.[tf] || [`${asset} updown ${tf}`];
    const allEvents: any[] = [];

    // Search with all queries for this asset+timeframe
    const searchResults = await Promise.all(queries.map(q => searchGamma(q)));
    for (const events of searchResults) {
      allEvents.push(...events);
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

    console.log(`[${asset}/${tf}] ${unique.length} unique events, ${active.length} active`);
    if (active.length > 0) {
      console.log(`[${asset}/${tf}] active slugs: ${active.map((e: any) => e.slug).join(', ')}`);
      console.log(`[${asset}/${tf}] active titles: ${active.map((e: any) => e.title).join(' | ')}`);
    }

    // Match timeframe from slug/title
    const matching = active.filter(ev => {
      const detected = identifyTimeframe(ev.slug || '', ev.title || '');
      return detected === tf;
    });

    console.log(`[${asset}/${tf}] ${matching.length} matching timeframe`);
    if (matching.length > 0) {
      console.log(`[${asset}/${tf}] slugs: ${matching.slice(0, 3).map((e: any) => e.slug).join(', ')}`);
    }

    if (matching.length === 0) continue;

    // Pick latest by endDate (most current/upcoming)
    matching.sort((a, b) => {
      const aEnd = new Date(a.endDate || a.end_date || 0).getTime();
      const bEnd = new Date(b.endDate || b.end_date || 0).getTime();
      return bEnd - aEnd;
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
      } catch {
        // fallback
      }

      // Fallback to outcomePrices
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

    // Process all assets in parallel
    const promises = assets.map(a => discoverForAsset(a, timeframes));
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
