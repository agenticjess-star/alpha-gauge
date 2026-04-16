import { describe, it, expect } from 'vitest';
import { extractPriceToBeat, getTimeRemaining } from '@/lib/marketDisplay';

describe('marketDisplay', () => {
  it('extracts strike prices from market titles', () => {
    expect(extractPriceToBeat('BTC above $87,500 by 12PM ET?')).toBe(87500);
    expect(extractPriceToBeat('ETH above $2,345.67 at close?')).toBe(2345.67);
    expect(extractPriceToBeat('No strike present')).toBeNull();
  });

  it('formats time remaining deterministically', () => {
    const now = new Date('2026-01-01T00:00:00.000Z').getTime();
    expect(getTimeRemaining('2026-01-01T00:10:00.000Z', now)).toBe('10m left');
    expect(getTimeRemaining('2026-01-01T03:15:00.000Z', now)).toBe('3h 15m left');
    expect(getTimeRemaining('2026-01-03T00:00:00.000Z', now)).toBe('2d left');
    expect(getTimeRemaining('2025-12-31T23:59:00.000Z', now)).toBe('EXPIRED');
  });
});
