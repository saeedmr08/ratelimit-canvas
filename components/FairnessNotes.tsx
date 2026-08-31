"use client";

import type { LimiterKind } from "@/lib/limiters";

const NOTES: Record<
  LimiterKind,
  { title: string; body: string }[]
> = {
  fixed: [
    {
      title: "Fixed Window",
      body: "Cheap counter that resets on hard boundaries. Fair within a window, but two adjacent windows can admit nearly 2× the limit across the edge — the classic boundary burst.",
    },
    {
      title: "Who gets through",
      body: "Early arrivals in each window win. Late traffic in a busy window is starved even if the previous window was quiet.",
    },
    {
      title: "When to use",
      body: "Simple API quotas, coarse abuse throttles, and places where approximate fairness and tiny memory matter more than smoothness.",
    },
  ],
  sliding: [
    {
      title: "Sliding Window",
      body: "Remembers accept timestamps and enforces the limit over any rolling interval. Removes the fixed-window boundary spike at the cost of more state.",
    },
    {
      title: "Who gets through",
      body: "More even over time: a request is judged against recent history, so neither edge of a clock window gets a free double quota.",
    },
    {
      title: "When to use",
      body: "User-facing APIs where perceived fairness matters and request volume per key stays bounded enough to store a short log or use a counter approximation.",
    },
  ],
  token: [
    {
      title: "Token Bucket",
      body: "Tokens refill at a sustained rate up to a burst capacity. Idle clients bank tokens; busy ones drain the bucket then wait for refill.",
    },
    {
      title: "Who gets through",
      body: "Short legitimate spikes pass (up to burst). Sustained overload is shaped to the refill rate — friendly to bursty UIs and retry storms that settle.",
    },
    {
      title: "When to use",
      body: "Gateways and services that must absorb bursts without abandoning a clear long-term rate. Tune burst carefully; oversized burst ≈ weak limit.",
    },
  ],
};

type Props = {
  kind: LimiterKind;
};

export function FairnessNotes({ kind }: Props) {
  const notes = NOTES[kind];
  return (
    <div>
      <p className="section-label">Fairness & trade-offs</p>
      <div className="fairness">
        {notes.map((n, i) => (
          <article key={n.title} className={`note${i === 0 ? " active" : ""}`}>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
