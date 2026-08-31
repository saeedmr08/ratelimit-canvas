import { describe, expect, it } from "vitest";
import {
  FixedWindowLimiter,
  SlidingWindowLimiter,
  TokenBucketLimiter,
  generateArrivals,
  runSimulation,
} from "./limiters";

describe("FixedWindowLimiter", () => {
  it("allows up to the limit inside one window, then denies", () => {
    const lim = new FixedWindowLimiter(3, 1000);
    const seq = [0, 100, 200, 300, 400].map((t) => lim.tryAllow(t).allowed);
    expect(seq).toEqual([true, true, true, false, false]);
  });

  it("resets the counter when a new window begins", () => {
    const lim = new FixedWindowLimiter(2, 1000);
    expect(lim.tryAllow(0).allowed).toBe(true);
    expect(lim.tryAllow(100).allowed).toBe(true);
    expect(lim.tryAllow(200).allowed).toBe(false);
    // New window at t=1000
    expect(lim.tryAllow(1000).allowed).toBe(true);
    expect(lim.tryAllow(1100).allowed).toBe(true);
    expect(lim.tryAllow(1200).allowed).toBe(false);
  });

  it("exhibits the classic boundary burst (two windows abutting)", () => {
    const lim = new FixedWindowLimiter(2, 1000);
    // End of first window
    expect(lim.tryAllow(900).allowed).toBe(true);
    expect(lim.tryAllow(950).allowed).toBe(true);
    // Start of next window — full quota again
    expect(lim.tryAllow(1000).allowed).toBe(true);
    expect(lim.tryAllow(1001).allowed).toBe(true);
    expect(lim.tryAllow(1002).allowed).toBe(false);
  });

  it("reports remaining correctly", () => {
    const lim = new FixedWindowLimiter(2, 1000);
    expect(lim.tryAllow(0).remaining).toBe(1);
    expect(lim.tryAllow(10).remaining).toBe(0);
    expect(lim.tryAllow(20).remaining).toBe(0);
  });
});

describe("SlidingWindowLimiter", () => {
  it("allows up to the limit inside any rolling window", () => {
    const lim = new SlidingWindowLimiter(3, 1000);
    const seq = [0, 100, 200, 300].map((t) => lim.tryAllow(t).allowed);
    expect(seq).toEqual([true, true, true, false]);
  });

  it("frees a slot when the oldest request ages out of the window", () => {
    const lim = new SlidingWindowLimiter(2, 1000);
    expect(lim.tryAllow(0).allowed).toBe(true);
    expect(lim.tryAllow(100).allowed).toBe(true);
    expect(lim.tryAllow(200).allowed).toBe(false);
    // Request at t=0 ages out at t=1000 (strictly > cutoff)
    expect(lim.tryAllow(1000).allowed).toBe(true);
    expect(lim.tryAllow(1001).allowed).toBe(false); // still has 100 and 1000
    expect(lim.tryAllow(1101).allowed).toBe(true); // 100 aged out
  });

  it("smooths the fixed-window boundary burst", () => {
    const lim = new SlidingWindowLimiter(2, 1000);
    expect(lim.tryAllow(900).allowed).toBe(true);
    expect(lim.tryAllow(950).allowed).toBe(true);
    // Still two in the last 1000ms — deny at the boundary
    expect(lim.tryAllow(1000).allowed).toBe(false);
    expect(lim.tryAllow(1901).allowed).toBe(true);
  });
});

describe("TokenBucketLimiter", () => {
  it("allows a burst up to capacity, then denies until refill", () => {
    const lim = new TokenBucketLimiter(1, 3); // 1 token/sec, burst 3
    expect(lim.tryAllow(0).allowed).toBe(true);
    expect(lim.tryAllow(0).allowed).toBe(true);
    expect(lim.tryAllow(0).allowed).toBe(true);
    expect(lim.tryAllow(0).allowed).toBe(false);
  });

  it("refills tokens over time at the configured rate", () => {
    const lim = new TokenBucketLimiter(2, 2); // 2 tokens/sec, capacity 2
    expect(lim.tryAllow(0).allowed).toBe(true);
    expect(lim.tryAllow(0).allowed).toBe(true);
    expect(lim.tryAllow(0).allowed).toBe(false);
    // After 500ms → +1 token
    expect(lim.tryAllow(500).allowed).toBe(true);
    expect(lim.tryAllow(500).allowed).toBe(false);
    // After another 1000ms from last refill → +2, capped at capacity
    expect(lim.tryAllow(1500).allowed).toBe(true);
    expect(lim.tryAllow(1500).allowed).toBe(true);
    expect(lim.tryAllow(1500).allowed).toBe(false);
  });

  it("never accumulates above capacity", () => {
    const lim = new TokenBucketLimiter(10, 2);
    // Idle for a long time
    expect(lim.tryAllow(0).remaining).toBe(1); // spent 1 of 2
    lim.reset();
    const d = lim.tryAllow(10_000);
    // Still only capacity tokens available after long idle
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBeLessThanOrEqual(1);
    expect(lim.tryAllow(10_000).allowed).toBe(true);
    expect(lim.tryAllow(10_000).allowed).toBe(false);
  });
});

describe("generateArrivals", () => {
  it("produces steady, evenly spaced timestamps", () => {
    const times = generateArrivals("steady", 5, 1000);
    expect(times).toHaveLength(5);
    expect(times[0]).toBe(0);
    expect(times[4]).toBeCloseTo(800, 5);
  });

  it("clusters burst arrivals into early/mid/late groups", () => {
    const times = generateArrivals("burst", 20, 10_000);
    expect(times).toHaveLength(20);
    const early = times.filter((t) => t < 2000).length;
    const late = times.filter((t) => t >= 7500).length;
    expect(early).toBeGreaterThan(5);
    expect(late).toBeGreaterThan(5);
  });

  it("is reproducible for the random pattern given a seed", () => {
    const a = generateArrivals("random", 10, 5000, 7);
    const b = generateArrivals("random", 10, 5000, 7);
    expect(a).toEqual(b);
  });
});

describe("runSimulation", () => {
  it("counts allowed and rejected for fixed window", () => {
    const result = runSimulation({
      kind: "fixed",
      rate: 5,
      burst: 5,
      windowMs: 1000,
      pattern: "steady",
      requestCount: 20,
      durationMs: 2000,
    });
    expect(result.events).toHaveLength(20);
    expect(result.allowedCount + result.rejectedCount).toBe(20);
    expect(result.allowedCount).toBeGreaterThan(0);
  });

  it("token bucket respects burst on a simultaneous spike", () => {
    const result = runSimulation({
      kind: "token",
      rate: 1,
      burst: 4,
      windowMs: 1000,
      pattern: "burst",
      requestCount: 12,
      durationMs: 100,
      seed: 1,
    });
    // First cluster is dense — at most `burst` should pass immediately
    const firstCluster = result.events.filter((e) => e.timeMs < 50);
    const allowedInFirst = firstCluster.filter((e) => e.allowed).length;
    expect(allowedInFirst).toBeLessThanOrEqual(4);
  });
});
