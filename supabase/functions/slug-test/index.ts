const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Quick test: fetch event by exact slug
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') || 'btc-updown-5m-1772957400';
  
  try {
    const apiUrl = `https://gamma-api.polymarket.com/events/slug/${slug}`;
    console.log('Fetching:', apiUrl);
    const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
    const text = await res.text();
    console.log('Status:', res.status, 'Body length:', text.length);
    
    // Extract just key fields
    try {
      const data = JSON.parse(text);
      const summary = {
        id: data.id,
        slug: data.slug,
        title: data.title,
        active: data.active,
        closed: data.closed,
        endDate: data.endDate,
        marketsCount: data.markets?.length || 0,
        firstMarket: data.markets?.[0] ? {
          id: data.markets[0].id,
          question: data.markets[0].question,
          clobTokenIds: data.markets[0].clobTokenIds,
          outcomePrices: data.markets[0].outcomePrices,
          active: data.markets[0].active,
          closed: data.markets[0].closed,
        } : null,
      };
      return new Response(JSON.stringify(summary, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
