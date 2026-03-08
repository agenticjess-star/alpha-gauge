import { useEffect, useRef, useCallback, useState } from 'react';

const CLOB_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

export interface ClobPriceUpdate {
  tokenId: string;
  price: number;
  timestamp: number;
}

export interface ClobWebSocketState {
  connected: boolean;
  prices: Record<string, number>;
  lastUpdate: number | null;
}

interface UseClobWebSocketOptions {
  onNewMarket?: (event: any) => void;
}

/**
 * Connects to Polymarket CLOB Market WebSocket for real-time
 * Up/Down contract price streaming and new_market discovery.
 */
export function useClobWebSocket(tokenIds: string[], options?: UseClobWebSocketOptions) {
  const [state, setState] = useState<ClobWebSocketState>({
    connected: false,
    prices: {},
    lastUpdate: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTokenIds = useRef<string[]>([]);
  const reconnectAttempts = useRef(0);
  const onNewMarketRef = useRef(options?.onNewMarket);
  onNewMarketRef.current = options?.onNewMarket;
  const maxReconnectDelay = 30000;

  const subscribe = useCallback((ws: WebSocket, ids: string[]) => {
    if (ids.length === 0 || ws.readyState !== WebSocket.OPEN) return;

    const msg = {
      assets_ids: ids,
      type: 'market',
      custom_feature_enabled: true,
    };
    console.log('[CLOB-WS] Subscribing to', ids.length, 'tokens');
    ws.send(JSON.stringify(msg));
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(CLOB_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[CLOB-WS] Connected');
      reconnectAttempts.current = 0;
      setState(prev => ({ ...prev, connected: true }));
      subscribe(ws, currentTokenIds.current);
    };

    ws.onmessage = (event) => {
      try {
        const msgs = JSON.parse(event.data);
        const updates = Array.isArray(msgs) ? msgs : [msgs];

        setState(prev => {
          let changed = false;
          const newPrices = { ...prev.prices };

          for (const msg of updates) {
            // price_change event: { event_type: "price_change", asset_id, price, ... }
            if (msg.event_type === 'price_change' && msg.asset_id && msg.price != null) {
              const price = typeof msg.price === 'string' ? parseFloat(msg.price) : msg.price;
              if (!isNaN(price) && price > 0) {
                newPrices[msg.asset_id] = price;
                changed = true;
              }
            }

            // last_trade_price event
            if (msg.event_type === 'last_trade_price' && msg.asset_id && msg.price != null) {
              const price = typeof msg.price === 'string' ? parseFloat(msg.price) : msg.price;
              if (!isNaN(price) && price > 0) {
                newPrices[msg.asset_id] = price;
                changed = true;
              }
            }

            // book event — extract best bid as price estimate
            if (msg.event_type === 'book' && msg.asset_id && msg.bids?.length > 0) {
              const bestBid = msg.bids[0];
              const price = typeof bestBid.price === 'string' ? parseFloat(bestBid.price) : bestBid.price;
              if (!isNaN(price) && price > 0) {
                newPrices[msg.asset_id] = price;
                changed = true;
              }
            }

            // new_market event — log for discovery
            if (msg.event_type === 'new_market') {
              console.log('[CLOB-WS] New market detected:', msg);
              onNewMarketRef.current?.(msg);
            }
          }

          if (!changed) return prev;
          return { ...prev, prices: newPrices, lastUpdate: Date.now() };
        });
      } catch {
        // ignore non-JSON
      }
    };

    ws.onerror = () => {
      console.warn('[CLOB-WS] Error');
    };

    ws.onclose = () => {
      setState(prev => ({ ...prev, connected: false }));
      // Exponential backoff reconnect
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, maxReconnectDelay);
      reconnectAttempts.current++;
      console.log(`[CLOB-WS] Reconnecting in ${delay}ms`);
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, [subscribe]);

  // Update subscriptions when tokenIds change
  useEffect(() => {
    const prev = currentTokenIds.current;
    const next = tokenIds.filter(Boolean);

    // Check if changed
    const same = prev.length === next.length && prev.every((id, i) => id === next[i]);
    if (same) return;

    currentTokenIds.current = next;

    // If already connected, re-subscribe
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      subscribe(wsRef.current, next);
    }
  }, [tokenIds, subscribe]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    currentTokenIds.current = tokenIds.filter(Boolean);
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // connect once

  return state;
}
