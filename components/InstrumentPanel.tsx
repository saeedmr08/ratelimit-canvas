"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ArrivalPattern,
  type LimiterKind,
  runSimulation,
} from "@/lib/limiters";
import { TimelineCanvas } from "./TimelineCanvas";
import { FairnessNotes } from "./FairnessNotes";

const ALGOS: { id: LimiterKind; label: string }[] = [
  { id: "fixed", label: "Fixed Window" },
  { id: "sliding", label: "Sliding Window" },
  { id: "token", label: "Token Bucket" },
];

const STORAGE_KEY = "ratelimit-canvas:settings:v1";

type Settings = {
  kind: LimiterKind;
  rate: number;
  burst: number;
  windowSec: number;
  pattern: ArrivalPattern;
  requestCount: number;
  durationSec: number;
  seed: number;
};

const DEFAULTS: Settings = {
  kind: "fixed",
  rate: 8,
  burst: 12,
  windowSec: 1,
  pattern: "burst",
  requestCount: 40,
  durationSec: 4,
  seed: 42,
};

const PRESETS: {
  id: ArrivalPattern;
  label: string;
  hint: string;
  patch: Partial<Settings>;
}[] = [
  {
    id: "steady",
    label: "Steady",
    hint: "Even spacing across the timeline",
    patch: { pattern: "steady", requestCount: 40, durationSec: 4, rate: 10 },
  },
  {
    id: "burst",
    label: "Burst",
    hint: "Clustered spikes at early / mid / late",
    patch: { pattern: "burst", requestCount: 48, durationSec: 4, rate: 8, burst: 14 },
  },
  {
    id: "random",
    label: "Random",
    hint: "Seeded irregular arrivals",
    patch: { pattern: "random", requestCount: 40, durationSec: 5, seed: 42, rate: 8 },
  },
];

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function InstrumentPanel() {
  const [kind, setKind] = useState<LimiterKind>(DEFAULTS.kind);
  const [rate, setRate] = useState(DEFAULTS.rate);
  const [burst, setBurst] = useState(DEFAULTS.burst);
  const [windowSec, setWindowSec] = useState(DEFAULTS.windowSec);
  const [pattern, setPattern] = useState<ArrivalPattern>(DEFAULTS.pattern);
  const [requestCount, setRequestCount] = useState(DEFAULTS.requestCount);
  const [durationSec, setDurationSec] = useState(DEFAULTS.durationSec);
  const [seed, setSeed] = useState(DEFAULTS.seed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setKind(s.kind);
    setRate(s.rate);
    setBurst(s.burst);
    setWindowSec(s.windowSec);
    setPattern(s.pattern);
    setRequestCount(s.requestCount);
    setDurationSec(s.durationSec);
    setSeed(s.seed);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const settings: Settings = {
      kind,
      rate,
      burst,
      windowSec,
      pattern,
      requestCount,
      durationSec,
      seed,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore quota */
    }
  }, [
    hydrated,
    kind,
    rate,
    burst,
    windowSec,
    pattern,
    requestCount,
    durationSec,
    seed,
  ]);

  const applyPreset = (id: ArrivalPattern) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const next = { ...loadSettings(), ...preset.patch, pattern: id };
    setKind(next.kind);
    setRate(next.rate);
    setBurst(next.burst);
    setWindowSec(next.windowSec);
    setPattern(next.pattern);
    setRequestCount(next.requestCount);
    setDurationSec(next.durationSec);
    setSeed(next.seed);
  };

  const windowMs = Math.round(windowSec * 1000);
  const durationMs = Math.round(durationSec * 1000);

  const result = useMemo(
    () =>
      runSimulation({
        kind,
        rate,
        burst,
        windowMs,
        pattern,
        requestCount,
        durationMs,
        seed,
      }),
    [kind, rate, burst, windowMs, pattern, requestCount, durationMs, seed],
  );

  const acceptPct =
    result.events.length === 0
      ? 0
      : Math.round((result.allowedCount / result.events.length) * 100);

  return (
    <div className="panel">
      <div className="panel-inner">
        <div>
          <p className="section-label">Arrival presets</p>
          <div className="algo-tabs" role="group" aria-label="Arrival presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="algo-tab"
                aria-pressed={pattern === p.id}
                title={p.hint}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="section-label" style={{ marginTop: "0.75rem" }}>
            Last settings saved to localStorage
          </p>
        </div>

        <div>
          <p className="section-label">Algorithm channel</p>
          <div className="algo-tabs" role="group" aria-label="Rate limiter algorithm">
            {ALGOS.map((a) => (
              <button
                key={a.id}
                type="button"
                className="algo-tab"
                aria-pressed={kind === a.id}
                onClick={() => setKind(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="section-label">Instrument controls</p>
          <div className="controls">
            <div className="control">
              <label htmlFor="rate">
                {kind === "token" ? "Refill rate (tok/s)" : "Limit / window"}
              </label>
              <span className="value">{rate}</span>
              <input
                id="rate"
                type="range"
                min={1}
                max={30}
                step={1}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              />
            </div>

            <div className="control">
              <label htmlFor="burst">Burst capacity</label>
              <span className="value">{burst}</span>
              <input
                id="burst"
                type="range"
                min={1}
                max={40}
                step={1}
                value={burst}
                disabled={kind !== "token"}
                onChange={(e) => setBurst(Number(e.target.value))}
                title={
                  kind !== "token"
                    ? "Burst applies to Token Bucket"
                    : "Maximum tokens"
                }
              />
            </div>

            <div className="control">
              <label htmlFor="window">Window size (s)</label>
              <span className="value">{windowSec.toFixed(1)}</span>
              <input
                id="window"
                type="range"
                min={0.5}
                max={4}
                step={0.5}
                value={windowSec}
                disabled={kind === "token"}
                onChange={(e) => setWindowSec(Number(e.target.value))}
              />
            </div>

            <div className="control">
              <label htmlFor="pattern">Arrival pattern</label>
              <select
                id="pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value as ArrivalPattern)}
              >
                <option value="steady">Steady</option>
                <option value="burst">Burst clusters</option>
                <option value="random">Random</option>
              </select>
            </div>

            <div className="control">
              <label htmlFor="count">Request count</label>
              <span className="value">{requestCount}</span>
              <input
                id="count"
                type="range"
                min={10}
                max={80}
                step={5}
                value={requestCount}
                onChange={(e) => setRequestCount(Number(e.target.value))}
              />
            </div>

            <div className="control">
              <label htmlFor="duration">Timeline (s)</label>
              <span className="value">{durationSec.toFixed(1)}</span>
              <input
                id="duration"
                type="range"
                min={2}
                max={10}
                step={0.5}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
              />
            </div>

            <div className="control">
              <label htmlFor="seed">Random seed</label>
              <span className="value">{seed}</span>
              <input
                id="seed"
                type="range"
                min={1}
                max={99}
                step={1}
                value={seed}
                disabled={pattern !== "random"}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="stats" aria-live="polite">
          <div className="stat ok">
            <div className="k">Allowed</div>
            <div className="v">{result.allowedCount}</div>
          </div>
          <div className="stat deny">
            <div className="k">Rejected</div>
            <div className="v">{result.rejectedCount}</div>
          </div>
          <div className="stat rate">
            <div className="k">Accept %</div>
            <div className="v">{acceptPct}</div>
          </div>
        </div>

        <div>
          <p className="section-label">Trace strip</p>
          <TimelineCanvas
            events={result.events}
            durationMs={durationMs}
            windowMs={windowMs}
            kind={kind}
          />
        </div>

        <FairnessNotes kind={kind} />
      </div>
    </div>
  );
}
