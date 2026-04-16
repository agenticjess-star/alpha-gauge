import { useCallback, useEffect, useRef, useState } from 'react';

export interface PricePoint {
  time: number;
  price: number;
}

const MAX_POINTS = 300;

export function usePriceHistory(price: number | null, maxPoints = MAX_POINTS) {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const lastPrice = useRef<number | null>(null);

  useEffect(() => {
    if (price === null || price === lastPrice.current) return;
    lastPrice.current = price;
    setHistory(prev => {
      const next = [...prev, { time: Date.now(), price }];
      return next.length > maxPoints ? next.slice(-maxPoints) : next;
    });
  }, [price, maxPoints]);

  const reset = useCallback(() => {
    setHistory([]);
    lastPrice.current = null;
  }, []);

  return { history, reset };
}
