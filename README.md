# Trading OS — Polymarket Crypto Up/Down Real-Time Engine

A real-time trading intelligence dashboard that streams live crypto Up/Down contract prices from Polymarket, combining deterministic market discovery with sub-second WebSocket price feeds. Built to be the fastest, most reliable way to monitor and analyze rotating binary crypto markets.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Lovable Cloud (Supabase Edge Functions)
- **Data Sources**: Polymarket Gamma API, CLOB WebSocket, RTDS WebSocket
- **Analysis**: Particle Filter, Monte Carlo simulation, Brier scoring, Decision Engine

---

## 🔑 The Polymarket Price Pipeline (Source of Truth)

This is the critical section. Everything below documents the exact patterns, endpoints, and protocols needed to wire up real-time Polymarket crypto data into any application.

### Market Discovery: Two Strategies

Polymarket uses **two different slug conventions** for crypto Up/Down markets:

#### Strategy 1: Deterministic Epoch-Based Slugs (5m, 15m, 4h)

These timeframes follow a predictable, computable pattern:

```
Pattern: {asset}-updown-{timeframe}-{epoch_timestamp}
Epoch:   floor(unix_seconds / interval) * interval

Examples:
  btc-updown-5m-1772959800    → 5min window starting at that epoch
  eth-updown-15m-1772959500   → 15min window
  btc-updown-4h-1772946000    → 4hour window
```

| Timeframe | Interval (seconds) | Slug Pattern |
|-----------|-------------------|--------------|
| 5m        | 300               | `{asset}-updown-5m-{epoch}` |
| 15m       | 900               | `{asset}-updown-15m-{epoch}` |
| 4h        | 14400             | `{asset}-updown-4h-{epoch}` |

**Discovery method**: Direct fetch via `GET https://gamma-api.polymarket.com/events/slug/{exact-slug}`

This is **deterministic** — you can compute the slug for any past or future window without searching. To find the currently active market, generate slugs for the current window + next few windows, fetch them all in parallel, and pick the one with `endDate > now && !closed`.

```typescript
// Generate the current window slug
const interval = 300; // 5m
const nowSec = Math.floor(Date.now() / 1000);
const currentWindow = Math.floor(nowSec / interval) * interval;
const slug = `btc-updown-5m-${currentWindow}`;

// Direct fetch — guaranteed to hit if market exists
const event = await fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`);
```

**2-day lookback/lookahead**: Generate past slugs by subtracting intervals, future by adding. For 5m markets, 2 days = 576 windows. We cap at 20 most recent for performance.

#### Strategy 2: Human-Readable Slugs (1h, Daily)

These timeframes use **non-deterministic** slug patterns with human-readable dates:

```
1h examples:
  bitcoin-up-or-down-march-8-4am-et
  ethereum-up-or-down-march-8-2pm-et

Daily examples:
  bitcoin-up-or-down-on-march-8
  solana-up-or-down-on-march-9
```

**Discovery method**: Search via `GET https://gamma-api.polymarket.com/events?title={query}&active=true`

Since these slugs can't be predicted, we search by title (e.g., "bitcoin up or down") and classify results by parsing the time range in the title to distinguish 1h from 4h from daily.

**Classification logic**:
- Title has 1-hour time range (e.g., "4AM-5AM") → `1h`
- Title has 4-hour time range (e.g., "4AM-8AM") → `4h`  
- Title/slug contains "on march 8" pattern → `daily`

### Verified Live Market URLs

| Timeframe | Example URL | Slug Type |
|-----------|-------------|-----------|
| 5m | `polymarket.com/event/btc-updown-5m-1772959200` | Epoch ✅ |
| 15m | `polymarket.com/event/btc-updown-15m-1772959500` | Epoch ✅ |
| 1h | `polymarket.com/event/bitcoin-up-or-down-march-8-4am-et` | Human ⚠️ |
| 4h | `polymarket.com/event/btc-updown-4h-1772946000` | Epoch ✅ |
| Daily | `polymarket.com/event/bitcoin-up-or-down-on-march-8` | Human ⚠️ |

### Assets Supported

| Asset | Epoch slug prefix | Search terms |
|-------|-------------------|--------------|
| BTC   | `btc-updown-*` | "bitcoin" |
| ETH   | `eth-updown-*` | "ethereum" |
| SOL   | `sol-updown-*` | "solana" |
| XRP   | `xrp-updown-*` | "xrp" |

---

## Real-Time Price Streaming: Two WebSockets

### 1. CLOB Market WebSocket (Contract Prices — Up/Down probabilities)

```
URL: wss://ws-subscriptions-clob.polymarket.com/ws/market
```

Streams live bid/ask/trade prices for Up/Down contracts (the actual probabilities).

**Subscribe message**:
```json
{
  "assets_ids": ["<token_id_1>", "<token_id_2>"],
  "type": "market",
  "custom_feature_enabled": true
}
```

**Critical: `custom_feature_enabled: true`** unlocks these events:
| Event | Data | Best For |
|-------|------|----------|
| `best_bid_ask` | best_bid, best_ask, spread | **Cleanest price source** |
| `price_change` | price | Price movement tracking |
| `last_trade_price` | price | Last executed trade |
| `book` | bids[], asks[] | Full order book |
| `new_market` | slug, assets_ids, outcomes | **Market rotation detection** |

**⚠️ HEARTBEAT REQUIRED**: Send literal string `PING` every **10 seconds** or the connection drops.

**Dynamic subscribe/unsubscribe**: When markets rotate, send new subscribe messages with new token IDs — no reconnect needed.

**Token IDs**: Found in each market's `clobTokenIds` field (JSON array). Index 0 = Up token, Index 1 = Down token.

### 2. RTDS WebSocket (Spot Prices — actual crypto prices)

```
URL: wss://ws-live-data.polymarket.com
```

Streams underlying crypto spot prices (BTC/USD, ETH/USD, etc.).

**Subscribe message**:
```json
{
  "action": "subscribe",
  "subscriptions": [{
    "topic": "crypto_prices",
    "type": "update",
    "filters": "btcusdt"
  }]
}
```

**Symbols**: `btcusdt`, `ethusdt`, `solusdt`, `xrpusdt` (Binance-style)

**Alternative**: Chainlink feed via topic `crypto_prices_chainlink` with symbols like `btc/usd`. Chainlink offers sponsored API keys via [signup form](https://pm-ds-request.streams.chain.link/).

**⚠️ HEARTBEAT REQUIRED**: Send literal string `PING` every **5 seconds**.

---

## REST Fallback (Polling)

For initial load and WebSocket fallback:

**Single price**:
```
GET https://clob.polymarket.com/price?token_id={id}&side=BUY
```

**Batch prices** (up to 500 tokens per request):
```
POST https://clob.polymarket.com/prices
Body: { "token_ids": ["id1", "id2", ...] }
```

**Event discovery**:
```
GET https://gamma-api.polymarket.com/events/slug/{slug}          ← deterministic
GET https://gamma-api.polymarket.com/events?title={query}&active=true  ← search
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ useCrypto│  │ useClob  │  │ useUpDownMarkets   │ │
│  │ Price    │  │ WebSocket│  │ (orchestrator)     │ │
│  │ (RTDS)  │  │ (CLOB)   │  │                    │ │
│  └────┬─────┘  └────┬─────┘  └─────────┬──────────┘ │
│       │              │                  │            │
│       ▼              ▼                  ▼            │
│  Spot prices    Contract prices    Discovery polling │
│  (5s PING)      (10s PING)         (20s interval)   │
└───────┬──────────────┬──────────────────┬────────────┘
        │              │                  │
        ▼              ▼                  ▼
   RTDS WebSocket  CLOB WebSocket   Edge Function
   (Binance feed)  (Polymarket)     (Supabase)
                                         │
                                         ▼
                                    Gamma API
                                    CLOB REST
```

### Data Flow

1. **Discovery** (Edge Function, every 20s + on `new_market` event):
   - Generates deterministic slugs for 5m/15m/4h
   - Searches Gamma API for 1h/daily
   - Fetches CLOB prices for active markets
   - Returns all discovered markets with initial prices

2. **Live Contract Prices** (CLOB WebSocket, sub-second):
   - Subscribes to all discovered token IDs
   - `best_bid_ask` events provide cleanest price feed
   - `new_market` events trigger instant re-discovery
   - Merged into market state via React useMemo

3. **Live Spot Prices** (RTDS WebSocket, sub-second):
   - Streams actual crypto prices (BTC $87,500, etc.)
   - Used for "price to beat" comparison in Up/Down markets

### Event-Driven Market Rotation

When a 5-minute market expires and the next one is created:

1. CLOB WebSocket fires `new_market` event with new token IDs
2. `useUpDownMarkets` receives event → triggers immediate `fetchAll()`
3. Edge function discovers new active window via slug prediction
4. New token IDs are sent to CLOB WebSocket via dynamic subscribe
5. Prices start streaming for the new market — no reconnection needed

---

## Analysis Pipeline

The probability engine processes live market data through:

1. **Particle Filter** (5000 particles) — Bayesian state estimation
2. **Monte Carlo** — Forward simulation of price paths
3. **Brier Scoring** — Calibration tracking of prediction accuracy
4. **Decision Engine** — BUY/HOLD/EXIT signals with confidence intervals
5. **Rules Engine** — Hard rule evaluation (edge thresholds, volume checks)
6. **Governance** — Decision logging and audit trail

---

## Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/crypto-updown-discovery/index.ts` | Edge function: slug generation, Gamma API, CLOB pricing |
| `src/hooks/useClobWebSocket.ts` | CLOB WebSocket: contract price streaming with 10s PING |
| `src/hooks/useCryptoPrice.ts` | RTDS WebSocket: spot price streaming with 5s PING |
| `src/hooks/useUpDownMarkets.ts` | Orchestrator: discovery polling + WS price merging |
| `src/hooks/useTradingEngine.ts` | Particle filter, Monte Carlo, Brier score, decision engine |
| `src/lib/updownTypes.ts` | Type definitions for markets, assets, timeframes |

## Slug Pattern Reference (Copy-Paste Ready)

```typescript
// ─── Epoch-based (5m, 15m, 4h) ──────────────────
const INTERVALS = { '5m': 300, '15m': 900, '4h': 14400 };

function getActiveSlug(asset: string, tf: string): string {
  const interval = INTERVALS[tf];
  const epoch = Math.floor(Date.now() / 1000);
  const window = Math.floor(epoch / interval) * interval;
  return `${asset}-updown-${tf}-${window}`;
}

// Direct fetch — guaranteed to hit if market exists
fetch(`https://gamma-api.polymarket.com/events/slug/${getActiveSlug('btc', '5m')}`);

// ─── Search-based (1h, daily) ────────────────────
// 1h: search "bitcoin up or down", filter by 1-hour time range in title
// daily: search "bitcoin up or down", filter by "on {date}" pattern
fetch(`https://gamma-api.polymarket.com/events?title=bitcoin+up+or+down&active=true`);
```

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `gamma-api.polymarket.com/events/slug/{slug}` | GET | Fetch event by deterministic slug |
| `gamma-api.polymarket.com/events?title={q}&active=true` | GET | Search events by title |
| `clob.polymarket.com/price?token_id={id}&side=BUY` | GET | Single token price |
| `clob.polymarket.com/prices` | POST | Batch token prices (up to 500) |
| `wss://ws-subscriptions-clob.polymarket.com/ws/market` | WS | Contract price streaming (10s PING) |
| `wss://ws-live-data.polymarket.com` | WS | Spot price streaming (5s PING) |

## Quick Start

```bash
npm install
npm run dev
```

The app automatically discovers active markets, connects WebSockets with proper heartbeats, streams live prices, and rotates to new markets as they're created on-chain.
