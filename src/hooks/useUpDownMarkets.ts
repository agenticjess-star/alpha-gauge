import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { UpDownMarket, CryptoAsset, UpDownTimeframe } from '@/lib/updownTypes';
import { useClobWebSocket } from './useClobWebSocket';

interface UseUpDownMarketsOptions {
  pollInterval?: number;
}

export function useUpDownMarkets({ pollInterval = 60000 }: UseUpDownMarketsOptions = {}) {
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

  // Extract all clobTokenIds from discovered markets for WebSocket subscription
  const allTokenIds = useMemo(() => {
    const ids: string[] = [];
    for (const mkt of allMarkets) {
      for (const m of mkt.markets) {
        if (m.clobTokenIds) {
          try {
            const parsed = typeof m.clobTokenIds === 'string'
              ? JSON.parse(m.clobTokenIds)
              : m.clobTokenIds;
            if (Array.isArray(parsed)) {
              ids.push(...parsed.filter((id: string) => typeof id === 'string' && id.length > 0));
            }
          } catch { /* ignore */ }
        }
      }
    }
    return ids;
  }, [allMarkets]);

  // Connect CLOB WebSocket for real-time price streaming
  const clobWs = useClobWebSocket(allTokenIds);

  // Merge WebSocket prices into discovered markets
  const marketsWithLivePrices = useMemo(() => {
    if (Object.keys(clobWs.prices).length === 0) return allMarkets;

    return allMarkets.map(mkt => {
      const firstMarket = mkt.markets[0];
      if (!firstMarket?.clobTokenIds) return mkt;

      try {
        const tokenIds = typeof firstMarket.clobTokenIds === 'string'
          ? JSON.parse(firstMarket.clobTokenIds)
          : firstMarket.clobTokenIds;

        if (!Array.isArray(tokenIds) || tokenIds.length < 2) return mkt;

        const wsUpPrice = clobWs.prices[tokenIds[0]];
        const wsDownPrice = clobWs.prices[tokenIds[1]];

        // Only override if we got a WS price
        return {
          ...mkt,
          upPrice: wsUpPrice ?? mkt.upPrice,
          downPrice: wsDownPrice ?? mkt.downPrice,
        };
      } catch {
        return mkt;
      }
    });
  }, [allMarkets, clobWs.prices]);

  // Get the active market for current selection
  const activeMarket = marketsWithLivePrices.find(
    m => m.asset === selectedAsset && m.timeframe === selectedTimeframe
  ) || null;

  // Get counts per asset
  const assetCounts = marketsWithLivePrices.reduce((acc, m) => {
    acc[m.asset] = (acc[m.asset] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    allMarkets: marketsWithLivePrices,
    activeMarket,
    selectedAsset,
    selectedTimeframe,
    setSelectedAsset,
    setSelectedTimeframe,
    loading,
    error,
    assetCounts,
    refetch: fetchAll,
    clobConnected: clobWs.connected,
    clobLastUpdate: clobWs.lastUpdate,
  };
}
