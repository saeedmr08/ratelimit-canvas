import { InstrumentPanel } from "@/components/InstrumentPanel";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="masthead">
        <p className="meta-row">
          <span>Instrument · RL-29</span>
          <span>Paper / Copper / Teal</span>
          <span>Saeed Rumaneh · 2026</span>
        </p>
        <h1 className="brand">
          RateLimit <span>Canvas</span>
        </h1>
        <p className="tagline">
          Dial the rate, burst, and arrival pattern. Compare Fixed Window,
          Sliding Window, and Token Bucket on one shared traffic trace — allowed
          marks in teal, rejects in copper.
        </p>
      </header>

      <InstrumentPanel />

      <p className="footer">
        Pure TypeScript limiters in lib/limiters.ts · MIT License · Local
        simulation only — no live traffic is sent.
      </p>
    </main>
  );
}
