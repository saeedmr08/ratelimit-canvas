# RateLimit Canvas

Interactive instrument panel for comparing **Fixed Window**, **Sliding Window**, and **Token Bucket** rate limiters. Tune rate, burst, window size, and arrival pattern; watch allowed vs rejected requests on an SVG timeline.

Built by **Saeed Rumaneh** as an original portfolio project (algorithms + visualization). Client-side simulation only — `lib/limiters.ts` has no Node builtins.

## Why this exists

Rate-limit algorithms look similar on paper and diverge under real traffic. Fixed windows create boundary bursts; sliding windows trade memory for fairness; token buckets absorb spikes while enforcing a sustained rate. This canvas makes those trade-offs visible.

## Features

- Three algorithms with shared simulation controls
- Arrival **presets**: steady, burst, random
- Last settings persisted in **localStorage**
- SVG timeline with allowed (teal) vs rejected (copper) marks
- Fairness comparison notes for interview-ready talking points
- Unit tests for allow/deny sequences (Vitest)

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run typecheck
npm run build
```

## Algorithms (brief)

| Algorithm | Model | Strength | Weakness |
|-----------|--------|----------|----------|
| Fixed Window | Count resets on hard boundaries | Simple, cheap | Boundary burst (2× limit across the edge) |
| Sliding Window | Log of recent accept times | Smooth fairness | Memory grows with traffic |
| Token Bucket | Refill + burst capacity | Natural spikes, sustained rate | Needs careful burst/rate tuning |

## Project layout

```
app/           # Next.js App Router UI
components/    # Instrument panel, timeline, fairness notes
lib/limiters.ts
lib/limiters.test.ts
```

## Complete product flows

1. Choose **Burst** arrivals and **Token Bucket** — spikes are absorbed while the sustained rate still rejects extras.
2. Switch to **Fixed Window**, then **Sliding Window** — boundary burst vs smoother fairness on the same arrivals.
3. Tune rate/window and reload — last settings persist in `localStorage`.

## License

MIT © 2026 Saeed Rumaneh
