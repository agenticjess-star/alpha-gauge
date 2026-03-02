import { useState, useEffect, useCallback, useRef } from 'react';
import type { UpDownMarket, CryptoAsset, UpDownTimeframe } from '@/lib/updownTypes';

interface UseUpDownMarketsOptions {
  pollInterval?: number;
}

export function useUpDownMarkets({ pollInterval = 20000 }: UseUpDownMarketsOptions = {}) {
  const [allMarkets, setAllMarkets] = useState<UpDownMarket[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>('btc');
  const [selectedTimeframe, setSelectedTimeframe] = useState<UpDownTimeframe>('5m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/crypto-updown-discovery?assets=btc,eth,sol,xrp&timeframe=5m,15m,1h`,
        {
          signal: controller.signal,
          headers: {
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) throw new Error(`Discovery error: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllMarkets(data);
        setError(null);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, pollInterval);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchAll, pollInterval]);

  // Get the active market for current selection
  const activeMarket = allMarkets.find(
    m => m.asset === selectedAsset && m.timeframe === selectedTimeframe
  ) || null;

  // Get counts per asset
  const assetCounts = allMarkets.reduce((acc, m) => {
    acc[m.asset] = (acc[m.asset] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    allMarkets,
    activeMarket,
    selectedAsset,
    selectedTimeframe,
    setSelectedAsset,
    setSelectedTimeframe,
    loading,
    error,
    assetCounts,
    refetch: fetchAll,
  };
}
