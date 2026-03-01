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
    const limit = url.searchParams.get('limit') || '10';
    const active = url.searchParams.get('active') || 'true';
    const closed = url.searchParams.get('closed') || 'false';
    const slug = url.searchParams.get('slug') || '';

    let apiUrl: string;

    if (endpoint === 'markets') {
      apiUrl = `${GAMMA_API}/markets?limit=${limit}&active=${active}&closed=${closed}`;
      if (slug) apiUrl += `&slug=${slug}`;
    } else if (endpoint === 'market' && slug) {
      apiUrl = `${GAMMA_API}/markets/${slug}`;
    } else {
      // Default: fetch events with nested markets
      apiUrl = `${GAMMA_API}/events?limit=${limit}&active=${active}&closed=${closed}`;
      if (slug) apiUrl += `&slug=${slug}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Polymarket API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
