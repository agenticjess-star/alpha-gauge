const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GAMMA_API = 'https://gamma-api.polymarket.com';
console.log('polymarket-proxy edge function loaded');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || 'events';
    const limit = url.searchParams.get('limit') || '20';
    const active = url.searchParams.get('active') || 'true';
    const closed = url.searchParams.get('closed') || 'false';
    const slug = url.searchParams.get('slug') || '';

    let apiUrl: string;

    if (endpoint === 'markets') {
      // Direct markets endpoint — already flat
      apiUrl = `${GAMMA_API}/markets?limit=${limit}&active=${active}&closed=${closed}&order=volume&ascending=false`;
      if (slug) apiUrl += `&slug=${slug}`;

      const response = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ error: `Polymarket API error: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: fetch events, then flatten nested markets into a single array
    apiUrl = `${GAMMA_API}/events?limit=${limit}&active=${active}&closed=${closed}`;
    if (slug) apiUrl += `&slug=${slug}`;

    const response = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Polymarket API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const events = await response.json();

    // Flatten: extract individual markets from events, each with real outcomePrices
    const flatMarkets: any[] = [];
    if (Array.isArray(events)) {
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          for (const market of event.markets) {
            // Only include open, active markets with real prices
            if (market.closed) continue;
            if (!market.outcomePrices) continue;
            flatMarkets.push({
              id: market.id,
              question: market.question || event.title,
              slug: market.slug || event.slug,
              outcomePrices: market.outcomePrices,
              volume: market.volume || market.volumeNum || '0',
              liquidity: market.liquidity || market.liquidityNum || '0',
              endDate: market.endDate || event.endDate || '',
              active: market.active ?? true,
              closed: market.closed ?? false,
              bestBid: market.bestBid,
              bestAsk: market.bestAsk,
              lastTradePrice: market.lastTradePrice,
              oneDayPriceChange: market.oneDayPriceChange,
              conditionId: market.conditionId,
              clobTokenIds: market.clobTokenIds,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify(flatMarkets), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
