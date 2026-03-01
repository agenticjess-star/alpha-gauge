

# Trading OS — Production Build Plan

## Philosophy

No mocks. No placeholders. No simulations. Every component computes real values, fetches real data, and produces real actionable output.

---

## Data Layer: Real Polymarket Markets

Polymarket's Gamma API (`gamma-api.polymarket.com`) serves real market data but blocks browser-origin requests (CORS). Solution: a Supabase Edge Function acting as a transparent proxy.

**Edge Function: `polymarket-proxy`**
- Proxies GET requests to `gamma-api.polymarket.com/events` and `/markets`
- Fetches active, open markets with real prices, volumes, slugs, and outcome tokens
- Returns clean JSON to the frontend — no transformation, no filtering of truth

**What the frontend receives:**
- Real contract names, real prices, real volumes
- Outcome token IDs for each market
- Active/closed status, expiry timestamps
- Current best bid/ask from the CLOB price endpoint

The `useMarkets` hook polls the edge function every 30 seconds. This is live data.

---

## Computation Layer: Real Engines Running in the Browser

### Particle Filter (`lib/particleFilter.ts`)
Full TypeScript port of the Sequential Monte Carlo filter from the article. Not a visualization gimmick — a real Bayesian inference engine.

- 5,000 particles in logit space
- Systematic resampling when ESS drops below N/2
- Processes real price observations from Polymarket as they arrive
- Outputs: filtered probability estimate, 95% credible interval, ESS, particle distribution
- Every `update()` call uses a real observed market price

### Monte Carlo Engine (`lib/monteCarloEngine.ts`)
Runs real path computations against the filtered probability:

- Antithetic variates for variance reduction (not optional — standard)
- Stratified sampling across probability quantiles
- Computes: probability estimate, standard error, confidence interval
- Input: current filtered probability + historical volatility derived from real price history
- Output: distributional assessment of contract value

### Brier Score Tracker (`lib/brierScore.ts`)
Tracks calibration of the particle filter against actual observed prices over time. Running score, updated every observation. This measures whether the engine is actually good — not whether it looks good.

### Decision Engine (`lib/decisionEngine.ts`)
Real rule-based logic. Takes as input:
- Filtered probability from particle filter
- Current market price (real)
- Edge = filtered probability minus market price
- Position limits, stop-loss thresholds, daily loss caps

Outputs one of three actions: BUY, HOLD, or EXIT — with the specific conditions that triggered it. Every condition is evaluated against real numbers.

---

## Architecture

```text
supabase/functions/
  polymarket-proxy/       -- Edge function: real API proxy

src/
  lib/
    particleFilter.ts     -- Sequential Monte Carlo engine
    monteCarloEngine.ts   -- Variance-reduced MC computation
    brierScore.ts         -- Calibration tracking
    decisionEngine.ts     -- Rule-based action logic
    types.ts              -- TypeScript interfaces for all data

  hooks/
    useMarkets.ts         -- Fetches real markets via edge function
    useParticleFilter.ts  -- Wraps particle filter, feeds real observations
    useLiveClock.ts       -- Real-time EST clock
    useTradingEngine.ts   -- Orchestrates: data in -> engines -> decisions out

  components/
    TopBar.tsx            -- Logo, live status, Brier score, clock
    MarketsPanel.tsx      -- Real Polymarket contracts, live prices
    ProbabilityEngine.tsx -- Hero probability, stats, particle viz
    ParticleCanvas.tsx    -- Canvas rendering real particle distribution
    MonteCarloGrid.tsx    -- Grid showing real MC sample outcomes
    BrierScoreDisplay.tsx -- Live calibration score
    DecisionEngine.tsx    -- BUY/HOLD/EXIT based on real edge
    RulesEngine.tsx       -- Hard rules with real violation detection
    GovernancePanel.tsx   -- Critical number tracking, decision log
    ConfidenceStrip.tsx   -- Visual confidence bands from real CI
    EscapeHatch.tsx       -- Override modal with logging

  pages/
    Index.tsx             -- Three-column OS layout
```

---

## UI: The Terminal Aesthetic

Pulled directly from the provided HTML/CSS design:
- Dark background (#080808), green (#00ff88), red (#ff3366), yellow (#ffd700)
- Fonts: Space Mono (data), Bebas Neue (hero numbers), DM Sans (body text)
- Three-column grid: Markets | Probability Engine | Governance
- 48px top bar with live indicators
- Canvas-based particle distribution visualization
- All animations: pulse on live status, fade-in on data updates, glow on probability numbers

---

## Build Sequence

**Turn 1: Foundation**
- Design system (CSS variables, fonts, Tailwind config)
- Type definitions for markets, particles, decisions
- Core engines: `particleFilter.ts`, `monteCarloEngine.ts`, `brierScore.ts`, `decisionEngine.ts`
- Supabase Edge Function: `polymarket-proxy`

**Turn 2: Data + Layout**
- `useMarkets` hook fetching real Polymarket data through the proxy
- OS grid layout in `Index.tsx`
- `TopBar` with live clock and status indicators
- `MarketsPanel` rendering real contracts with real prices

**Turn 3: Engine Integration**
- `useParticleFilter` processing real price observations
- `useTradingEngine` orchestrating all engines
- `ProbabilityEngine` displaying real filtered probability
- `ParticleCanvas` rendering real particle distribution
- `MonteCarloGrid` showing real computation results

**Turn 4: Decision + Governance**
- `DecisionEngine` component with real BUY/HOLD/EXIT logic
- `RulesEngine` with real threshold enforcement
- `GovernancePanel` with decision logging
- `BrierScoreDisplay` tracking real calibration
- `EscapeHatch` override system

---

## What Makes This Real

- Prices come from Polymarket's live API, not a random number generator
- The particle filter runs real Bayesian inference on those prices
- The Monte Carlo engine computes real distributional estimates with real variance reduction
- The decision engine evaluates real edge against real rules
- The Brier score measures real calibration against real outcomes
- Every number on screen is computed, not fabricated

