# Trading OS — Polymarket Crypto Up/Down Engine

A real-time prediction market dashboard that tracks **Polymarket's rotating crypto Up/Down contracts** across BTC, ETH, SOL, and XRP. Built with React + Vite, powered by Supabase Edge Functions for API proxying, and Polymarket's CLOB WebSocket for sub-second price streaming.

## The Core Problem

Polymarket creates **new prediction markets every 5 and 15 minutes** for each crypto asset (BTC, ETH, SOL, XRP). Each market asks: "Will the price go Up or Down in this window?" These markets rotate on a fixed schedule — but the challenge is **discovering them programmatically** because they don't appear in Polymarket's standard search.

## The Discovery Pattern (Key Insight)

### Deterministic Slug Generation

The breakthrough: Polymarket's rotating crypto markets follow a **predictable slug convention** tied to Unix epoch timestamps:

```
{asset}-updown-{timeframe}-{floor(epoch / interval) * interval}
```

Examples (for a 5-minute window starting at epoch 1772958600):
- `btc-updown-5m-1772958600`
- `eth-updown-5m-1772958600`
- `sol-updown-15m-1772958600`
- `xrp-updown-15m-1772958600`

This means we can **predict** the exact slug of any past, current, or future market by simply doing:

```typescript
const interval = 300; // 5m = 300s, 15m = 900s
const currentWindow = Math.floor(Date.now() / 1000 / interval) * interval;
const slug = `btc-updown-5m-${currentWindow}`;
```

### Direct Path Endpoint (Not Search)

Instead of using Polymarket's unreliable `public-search` endpoint, we hit the **direct path endpoint**:

```
GET https://gamma-api.polymarket.com/events/slug/{exact-slug}
```

This returns the full event with all market data, CLOB token IDs, and outcome prices — instantly and deterministically.

### 2-Day Rolling Window

By generating slugs for past windows, we pull **up to 20 resolved historical events** per asset/timeframe, giving the model:
- Resolved outcomes (Up/Down) for calibration
- Historical volume and liquidity data
- Win/loss patterns for Brier score tracking

### What About 1-Hour Markets?

**They don't exist on Polymarket** (as of March 2026). Only 5-minute and 15-minute crypto Up/Down series are active. The Gamma API tags confirm only `5M` series exist — no `1H` tag or series was found. This was verified by exhaustive search of the Gamma events API, public-search endpoint, tag filtering, and series endpoint.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     TRADING OS (React)                       │
├─────────────┬───────────────────────┬───────────────────────┤
│  Left Panel │    Center Panel       │   Right Panel          │
│  Discovery  │  Probability Engine   │   Governance           │
│  + History  │  + Particle Filter    │   + Decision Log       │
│             │  + Monte Carlo        │                        │
│             │  + Brier Score        │                        │
└──────┬──────┴──────────┬────────────┴───────────────────────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│ CLOB WebSocket│  │ RTDS WebSocket   │
│ (Market Prices)│  │ (Spot Prices)    │
│ wss://ws-sub..│  │ wss://ws-live... │
└──────────────┘  └──────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│    Supabase Edge Function            │
│    crypto-updown-discovery           │
│                                      │
│  • Predictive slug generation        │
│  • Direct path endpoint fetching     │
│  • CLOB price lookup per token       │
│  • 2-day historical lookback         │
│  • Outcome detection (resolved)      │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│    Polymarket Gamma API              │
│    gamma-api.polymarket.com          │
│                                      │
│  /events/slug/{slug}  ← direct hit  │
│  /public-search       ← NOT used    │
└──────────────────────────────────────┘
```

## Real-Time Data Pipeline

### 1. Discovery Layer (Edge Function, 20s poll)
- Generates predictive slugs for current + next 3 windows
- Fetches active events via direct Gamma path endpoint
- Fetches CLOB prices for Up/Down token IDs
- Returns enriched `DiscoveredMarket[]` with live prices

### 2. CLOB WebSocket (Sub-second updates)
- Connects to `wss://ws-subscriptions-clob.polymarket.com/ws/market`
- Subscribes to all active token IDs with `custom_feature_enabled: true`
- Streams `price_change`, `last_trade_price`, and `book` events
- Listens for `new_market` events to trigger instant re-discovery

### 3. Spot Price WebSocket (RTDS)
- Connects to `wss://ws-live-data.polymarket.com`
- Streams live crypto spot prices (BTC, ETH, SOL, XRP)
- Used for "price to beat" comparison in the UI

### 4. Market Rotation
When a market expires:
1. The `new_market` event fires on the CLOB WebSocket
2. `useUpDownMarkets` immediately calls `fetchAll()`
3. The edge function generates the next window's slug
4. New market is discovered and prices start streaming
5. Fallback: 20-second REST poll catches anything missed

## Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/crypto-updown-discovery/index.ts` | Edge function: slug generation, Gamma API, CLOB pricing |
| `src/hooks/useUpDownMarkets.ts` | React hook: discovery polling, WS integration, market selection |
| `src/hooks/useClobWebSocket.ts` | CLOB WebSocket: real-time contract price streaming |
| `src/hooks/useCryptoPrice.ts` | RTDS WebSocket: live spot price streaming |
| `src/hooks/useTradingEngine.ts` | Particle filter, Monte Carlo, Brier score, decision engine |
| `src/lib/updownTypes.ts` | Type definitions for markets, assets, timeframes |
| `src/components/UpDownDisplay.tsx` | Active market display with Up/Down percentages |
| `src/components/EventHistory.tsx` | Historical timeline with resolved outcomes |
| `src/components/ProbabilityEngine.tsx` | Probability visualization suite |

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase Edge Functions (Deno)
- **Data Sources**: Polymarket Gamma API, CLOB WebSocket, RTDS WebSocket
- **Charting**: Recharts
- **State**: React hooks + WebSocket refs (no external state management)

## Slug Reference Table

| Asset | 5-Minute | 15-Minute |
|-------|----------|-----------|
| BTC | `btc-updown-5m-{epoch}` | `btc-updown-15m-{epoch}` |
| ETH | `eth-updown-5m-{epoch}` | `eth-updown-15m-{epoch}` |
| SOL | `sol-updown-5m-{epoch}` | `sol-updown-15m-{epoch}` |
| XRP | `xrp-updown-5m-{epoch}` | `xrp-updown-15m-{epoch}` |

Where `{epoch}` = `Math.floor(unixTimestamp / intervalSeconds) * intervalSeconds`

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `gamma-api.polymarket.com/events/slug/{slug}` | GET | Fetch specific event by deterministic slug |
| `clob.polymarket.com/price?token_id={id}&side=BUY` | GET | Fetch current CLOB price for a token |
| `wss://ws-subscriptions-clob.polymarket.com/ws/market` | WS | Real-time market price streaming |
| `wss://ws-live-data.polymarket.com` | WS | Real-time spot price streaming |

## Running Locally

```bash
npm install
npm run dev
```

The app requires the Supabase Edge Function to be deployed for market discovery. The WebSocket connections to Polymarket are made directly from the browser.
