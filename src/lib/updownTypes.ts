/** Discovered up/down market from Gamma search + CLOB pricing */
export interface UpDownMarket {
  asset: string;       // btc, eth, sol, xrp
  timeframe: string;   // 5m, 15m, 1h
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  endDate: string;
  upPrice: number | null;
  downPrice: number | null;
  resolved?: boolean;
  outcome?: string | null; // 'Up' | 'Down' | null
  markets: {
    id: string;
    question: string;
    slug: string;
    outcomePrices: string;
    clobTokenIds: string;
    conditionId: string;
    active: boolean;
    closed: boolean;
    volume: string;
    liquidity: string;
  }[];
}

export type CryptoAsset = 'btc' | 'eth' | 'sol' | 'xrp';
export type UpDownTimeframe = '5m' | '15m';

export const CRYPTO_ASSETS: { label: string; value: CryptoAsset }[] = [
  { label: 'BTC', value: 'btc' },
  { label: 'ETH', value: 'eth' },
  { label: 'SOL', value: 'sol' },
  { label: 'XRP', value: 'xrp' },
];

export const UPDOWN_TIMEFRAMES: { label: string; value: UpDownTimeframe }[] = [
  { label: '5M', value: '5m' },
  { label: '15M', value: '15m' },
];
