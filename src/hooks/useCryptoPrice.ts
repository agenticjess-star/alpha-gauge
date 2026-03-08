import { useEffect, useRef, useState, useCallback } from 'react';
import type { CryptoAsset } from '@/lib/updownTypes';

const RTDS_URL = 'wss://ws-live-data.polymarket.com';
const RTDS_PING_INTERVAL = 5000; // 5s heartbeat per docs

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
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAsset = useRef(asset);

  const stopPing = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
  }, []);

  const startPing = useCallback((ws: WebSocket) => {
    stopPing();
    pingTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('PING');
      }
    }, RTDS_PING_INTERVAL);
  }, [stopPing]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopPing();

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
      startPing(ws);
    };

    ws.onmessage = (event) => {
      // Ignore PONG responses
      if (event.data === 'PONG') return;

      try {
        const data = JSON.parse(event.data);
        const processUpdate = (update: any) => {
          if (update.symbol?.toLowerCase() === symbol || update.s?.toLowerCase() === symbol) {
            const price = parseFloat(update.price ?? update.p ?? update.value ?? update.c);
            if (!isNaN(price) && price > 0) {
              setState(prev => ({ ...prev, price, timestamp: Date.now() }));
            }
          }
        };

        if (Array.isArray(data)) {
          data.forEach(processUpdate);
        } else {
          processUpdate(data);
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
      stopPing();
      reconnectTimer.current = setTimeout(connect, 5000);
    };
  }, [startPing, stopPing]);

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
      stopPing();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [asset, connect, stopPing]);

  return state;
}
