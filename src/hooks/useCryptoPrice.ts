import { useEffect, useRef, useState, useCallback } from 'react';
import type { CryptoAsset } from '@/lib/updownTypes';

const RTDS_URL = 'wss://ws-live-data.polymarket.com';

const ASSET_SYMBOLS: Record<CryptoAsset, string> = {
  btc: 'btcusdt',
  eth: 'ethusdt',
  sol: 'solusdt',
  xrp: 'xrpusdt',
};

export interface CryptoPriceState {
  price: number | null;
  symbol: string;
  timestamp: number | null;
  connected: boolean;
}

export function useCryptoPrice(asset: CryptoAsset) {
  const [state, setState] = useState<CryptoPriceState>({
    price: null,
    symbol: ASSET_SYMBOLS[asset],
    timestamp: null,
    connected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAsset = useRef(asset);

  const connect = useCallback(() => {
    // Clean up existing
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const symbol = ASSET_SYMBOLS[currentAsset.current];
    const ws = new WebSocket(RTDS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[RTDS] Connected, subscribing to', symbol);
      ws.send(JSON.stringify({
        action: 'subscribe',
        subscriptions: [{
          topic: 'crypto_prices',
          type: 'update',
          filters: symbol,
        }],
      }));
      setState(prev => ({ ...prev, connected: true, symbol }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // RTDS sends arrays of price updates
        if (Array.isArray(data)) {
          for (const update of data) {
            if (update.symbol?.toLowerCase() === symbol || update.s?.toLowerCase() === symbol) {
              const price = parseFloat(update.price ?? update.p ?? update.value ?? update.c);
              if (!isNaN(price) && price > 0) {
                setState(prev => ({
                  ...prev,
                  price,
                  timestamp: Date.now(),
                }));
              }
            }
          }
        } else if (data.symbol?.toLowerCase() === symbol || data.s?.toLowerCase() === symbol) {
          const price = parseFloat(data.price ?? data.p ?? data.value ?? data.c);
          if (!isNaN(price) && price > 0) {
            setState(prev => ({
              ...prev,
              price,
              timestamp: Date.now(),
            }));
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onerror = () => {
      console.warn('[RTDS] WebSocket error');
    };

    ws.onclose = () => {
      setState(prev => ({ ...prev, connected: false }));
      // Reconnect after 5s
      reconnectTimer.current = setTimeout(connect, 5000);
    };
  }, []);

  // Reconnect when asset changes
  useEffect(() => {
    currentAsset.current = asset;
    setState({
      price: null,
      symbol: ASSET_SYMBOLS[asset],
      timestamp: null,
      connected: false,
    });
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [asset, connect]);

  return state;
}
