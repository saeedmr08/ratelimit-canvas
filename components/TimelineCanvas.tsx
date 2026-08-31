"use client";

import type { RequestEvent } from "@/lib/limiters";

type Props = {
  events: RequestEvent[];
  durationMs: number;
  windowMs: number;
  kind: "fixed" | "sliding" | "token";
};

const WIDTH = 1000;
const HEIGHT = 160;
const PAD_X = 28;
const PAD_Y = 28;
const TRACK_Y = 72;

export function TimelineCanvas({ events, durationMs, windowMs, kind }: Props) {
  const span = Math.max(durationMs, 1);
  const plotW = WIDTH - PAD_X * 2;

  const xAt = (t: number) => PAD_X + (t / span) * plotW;

  const windowGuides: number[] = [];
  if (kind === "fixed" && windowMs > 0) {
    for (let t = 0; t <= span; t += windowMs) {
      windowGuides.push(t);
    }
  }

  return (
    <div className="timeline-wrap">
      <div className="timeline-legend">
        <span className="legend-item">
          <span className="swatch allow" /> Allowed
        </span>
        <span className="legend-item">
          <span className="swatch reject" /> Rejected
        </span>
        {kind === "fixed" ? (
          <span className="legend-item">Dashed lines = window edges</span>
        ) : null}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Request timeline showing allowed and rejected requests"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          <linearGradient id="trackFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f6f6a" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1f6f6a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline track */}
        <rect
          x={PAD_X}
          y={TRACK_Y - 18}
          width={plotW}
          height={36}
          fill="url(#trackFade)"
          rx={1}
        />
        <line
          x1={PAD_X}
          y1={TRACK_Y}
          x2={WIDTH - PAD_X}
          y2={TRACK_Y}
          stroke="#4a5652"
          strokeWidth={1.25}
          strokeOpacity={0.55}
        />

        {windowGuides.map((t) => (
          <line
            key={`wg-${t}`}
            x1={xAt(t)}
            y1={PAD_Y}
            x2={xAt(t)}
            y2={HEIGHT - 22}
            stroke="#b56a3c"
            strokeWidth={1}
            strokeDasharray="3 5"
            strokeOpacity={0.45}
          />
        ))}

        {/* time ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const t = f * span;
          const x = xAt(t);
          return (
            <g key={`tick-${f}`}>
              <line
                x1={x}
                y1={TRACK_Y + 18}
                x2={x}
                y2={TRACK_Y + 26}
                stroke="#4a5652"
                strokeWidth={1}
              />
              <text
                x={x}
                y={HEIGHT - 8}
                textAnchor="middle"
                fill="#4a5652"
                fontSize={11}
                fontFamily="IBM Plex Mono, monospace"
              >
                {(t / 1000).toFixed(1)}s
              </text>
            </g>
          );
        })}

        {events.map((ev) => {
          const x = xAt(ev.timeMs);
          const allowed = ev.allowed;
          const y = allowed ? TRACK_Y - 22 : TRACK_Y + 22;
          const color = allowed ? "#2a918a" : "#d4844f";
          return (
            <g key={ev.index}>
              <line
                x1={x}
                y1={TRACK_Y}
                x2={x}
                y2={y}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.85}
              >
                <animate
                  attributeName="stroke-opacity"
                  values="0;0.85"
                  dur="0.35s"
                  begin={`${Math.min(ev.index * 0.012, 0.6)}s`}
                  fill="freeze"
                />
              </line>
              <circle cx={x} cy={y} r={allowed ? 4.5 : 3.5} fill={color}>
                <animate
                  attributeName="r"
                  from="0"
                  to={allowed ? 4.5 : 3.5}
                  dur="0.28s"
                  begin={`${Math.min(ev.index * 0.012, 0.6)}s`}
                  fill="freeze"
                />
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
