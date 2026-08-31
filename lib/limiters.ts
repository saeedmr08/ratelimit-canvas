/**
 * Rate-limit algorithm primitives for RateLimit Canvas.
 * Pure, deterministic, and free of I/O — suitable for simulation and unit tests.
 */

export type Decision = {
  allowed: boolean;
  /** Tokens / remaining quota after the decision (algorithm-specific meaning). */
  remaining: number;
};

export interface RateLimiter {
  readonly name: string;
  reset(): void;
  /** Evaluate a request arriving at `timeMs` (milliseconds from an arbitrary origin). */
  tryAllow(timeMs: number): Decision;
}

/** Fixed-window counter: resets the count at hard window boundaries. */
export class FixedWindowLimiter implements RateLimiter {
  readonly name = "Fixed Window";
  private count = 0;
  private windowStart = 0;
  private started = false;

  constructor(
    /** Max allowed requests per window. */
    private readonly limit: number,
    /** Window length in milliseconds. */
    private readonly windowMs: number,
  ) {
    if (limit < 1) throw new Error("limit must be >= 1");
    if (windowMs < 1) throw new Error("windowMs must be >= 1");
  }

  reset(): void {
    this.count = 0;
    this.windowStart = 0;
    this.started = false;
  }

  tryAllow(timeMs: number): Decision {
    // Align to absolute window boundaries so the classic edge burst appears
    // (quota resets at t = k * windowMs, not relative to the first request).
    const alignedStart = Math.floor(timeMs / this.windowMs) * this.windowMs;
    if (!this.started || alignedStart !== this.windowStart) {
      this.windowStart = alignedStart;
      this.count = 0;
      this.started = true;
    }

    if (this.count < this.limit) {
      this.count += 1;
      return { allowed: true, remaining: this.limit - this.count };
    }
    return { allowed: false, remaining: 0 };
  }
}

/**
 * Sliding-window log: keeps timestamps of accepted requests and rejects when
 * the count inside `[t - windowMs, t]` would exceed the limit.
 */
export class SlidingWindowLimiter implements RateLimiter {
  readonly name = "Sliding Window";
  private timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {
    if (limit < 1) throw new Error("limit must be >= 1");
    if (windowMs < 1) throw new Error("windowMs must be >= 1");
  }

  reset(): void {
    this.timestamps = [];
  }

  tryAllow(timeMs: number): Decision {
    const cutoff = timeMs - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);

    if (this.timestamps.length < this.limit) {
      this.timestamps.push(timeMs);
      return {
        allowed: true,
        remaining: this.limit - this.timestamps.length,
      };
    }
    return { allowed: false, remaining: 0 };
  }
}

/**
 * Token bucket: capacity = burst; tokens refill continuously at `ratePerSecond`.
 * A request costs one token.
 */
export class TokenBucketLimiter implements RateLimiter {
  readonly name = "Token Bucket";
  private tokens: number;
  private lastRefillMs: number | null = null;

  constructor(
    /** Sustained refill rate (tokens per second). */
    private readonly ratePerSecond: number,
    /** Maximum tokens (burst capacity). */
    private readonly capacity: number,
  ) {
    if (ratePerSecond <= 0) throw new Error("ratePerSecond must be > 0");
    if (capacity < 1) throw new Error("capacity must be >= 1");
    this.tokens = capacity;
  }

  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillMs = null;
  }

  tryAllow(timeMs: number): Decision {
    if (this.lastRefillMs === null) {
      this.lastRefillMs = timeMs;
    } else {
      const elapsedSec = (timeMs - this.lastRefillMs) / 1000;
      if (elapsedSec > 0) {
        this.tokens = Math.min(
          this.capacity,
          this.tokens + elapsedSec * this.ratePerSecond,
        );
        this.lastRefillMs = timeMs;
      }
    }

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { allowed: true, remaining: this.tokens };
    }
    return { allowed: false, remaining: this.tokens };
  }
}

export type ArrivalPattern = "steady" | "burst" | "random";

export type LimiterKind = "fixed" | "sliding" | "token";

export type SimulationConfig = {
  kind: LimiterKind;
  /** Allowed requests per window (fixed/sliding) or refill rate per second (token). */
  rate: number;
  /** Burst capacity for token bucket; ignored by window algorithms except as a soft hint. */
  burst: number;
  /** Window size in milliseconds (fixed/sliding). */
  windowMs: number;
  /** How request arrivals are generated. */
  pattern: ArrivalPattern;
  /** Total requests to simulate. */
  requestCount: number;
  /** Total timeline span in milliseconds. */
  durationMs: number;
  /** Seed for reproducible random patterns. */
  seed?: number;
};

export type RequestEvent = {
  index: number;
  timeMs: number;
  allowed: boolean;
  remaining: number;
};

export type SimulationResult = {
  kind: LimiterKind;
  events: RequestEvent[];
  allowedCount: number;
  rejectedCount: number;
};

/** Mulberry32 PRNG — tiny, seedable, good enough for demos. */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate arrival timestamps in `[0, durationMs]` for the given pattern. */
export function generateArrivals(
  pattern: ArrivalPattern,
  requestCount: number,
  durationMs: number,
  seed = 42,
): number[] {
  if (requestCount < 1) return [];
  const times: number[] = [];

  if (pattern === "steady") {
    const gap = durationMs / requestCount;
    for (let i = 0; i < requestCount; i++) {
      times.push(Math.min(durationMs, i * gap));
    }
    return times;
  }

  if (pattern === "burst") {
    // Three clusters: early spike, mid lull spill, late spike.
    const clusters = [
      { start: 0, share: 0.45 },
      { start: durationMs * 0.4, share: 0.15 },
      { start: durationMs * 0.75, share: 0.4 },
    ];
    let assigned = 0;
    for (let c = 0; c < clusters.length; c++) {
      const count =
        c === clusters.length - 1
          ? requestCount - assigned
          : Math.round(requestCount * clusters[c].share);
      const span = durationMs * 0.12;
      for (let i = 0; i < count; i++) {
        const t = clusters[c].start + (count === 1 ? 0 : (i / (count - 1)) * span);
        times.push(Math.min(durationMs, t));
      }
      assigned += count;
    }
    return times.sort((a, b) => a - b);
  }

  // random
  const rng = createRng(seed);
  for (let i = 0; i < requestCount; i++) {
    times.push(rng() * durationMs);
  }
  return times.sort((a, b) => a - b);
}

export function createLimiter(config: SimulationConfig): RateLimiter {
  switch (config.kind) {
    case "fixed":
      return new FixedWindowLimiter(Math.max(1, Math.round(config.rate)), config.windowMs);
    case "sliding":
      return new SlidingWindowLimiter(Math.max(1, Math.round(config.rate)), config.windowMs);
    case "token":
      return new TokenBucketLimiter(
        Math.max(0.001, config.rate),
        Math.max(1, Math.round(config.burst)),
      );
    default: {
      const _exhaustive: never = config.kind;
      throw new Error(`Unknown limiter: ${_exhaustive}`);
    }
  }
}

/** Run a full simulation: generate arrivals and score each against the limiter. */
export function runSimulation(config: SimulationConfig): SimulationResult {
  const limiter = createLimiter(config);
  const arrivals = generateArrivals(
    config.pattern,
    config.requestCount,
    config.durationMs,
    config.seed ?? 42,
  );

  const events: RequestEvent[] = arrivals.map((timeMs, index) => {
    const decision = limiter.tryAllow(timeMs);
    return {
      index,
      timeMs,
      allowed: decision.allowed,
      remaining: decision.remaining,
    };
  });

  return {
    kind: config.kind,
    events,
    allowedCount: events.filter((e) => e.allowed).length,
    rejectedCount: events.filter((e) => !e.allowed).length,
  };
}
