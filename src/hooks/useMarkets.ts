import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Market } from '@/lib/types';

function parseMarket(raw: any): Market {
  let yesPrice = 0.5;
  let noPrice = 0.5;

  try {
    if (raw.outcomePrices) {
      const prices = typeof raw.outcomePrices === 'string'
        ? JSON.parse(raw.outcomePrices)
        : raw.outcomePrices;
      yesPrice = parseFloat(prices[0]) || 0.5;
      noPrice = parseFloat(prices[1]) || 0.5;
    }
  } catch {
    // fallback
  }

  return {
    id: raw.id || '',
    question: raw.question || raw.title || '',
    slug: raw.slug || '',
    yesPrice,
    noPrice,
    volume: parseFloat(raw.volume) || 0,
    liquidity: parseFloat(raw.liquidity) || 0,
    endDate: raw.endDate || raw.end_date || '',
    active: raw.active ?? true,
    closed: raw.closed ?? false,
  };
}

export function useMarkets(pollInterval = 30000) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMarkets = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Use the edge function which now flattens events→markets
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/polymarket-proxy?endpoint=events&limit=20&active=true&closed=false`,
        {
          signal: controller.signal,
          headers: {
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Proxy error: ${response.status}`);
      }

      const rawData = await response.json();
      const parsed = Array.isArray(rawData)
        ? rawData.map(parseMarket).filter(m => m.question && m.yesPrice > 0 && m.yesPrice < 1)
        : [];

      // Sort by volume descending — highest activity first
      parsed.sort((a, b) => b.volume - a.volume);

      setMarkets(parsed);
      setError(null);
      setLastFetch(Date.now());
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, pollInterval);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchMarkets, pollInterval]);

  return { markets, loading, error, lastFetch, refetch: fetchMarkets };
}
