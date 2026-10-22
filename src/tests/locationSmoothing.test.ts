// Deterministic traces check jitter, lag and known failure modes without claiming field accuracy.
import { describe, it, expect } from "vitest";
import { LocationSmoother } from "../tracking/locationSmoothing";
import { distance, type Point } from "../shared/recordingModel";
import { fixAt } from "./smoothingFixtures";

const rms = (values: number[]) =>
  Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length);
function trace(points: Point[], accuracy = 10) {
  const filter = new LocationSmoother();
  return points.map((point, index) =>
    filter.update(fixAt(index * 1000, accuracy), point)!,
  );
}

describe("accuracy-adaptive smoothing", () => {
  it("reduces alternating stationary RMS by at least half after warm-up", () => {
    const points = Array.from({ length: 31 }, (_, index) => ({
      x: index % 2 ? -3 : 3,
      y: 0,
    }));
    const output = trace(points).slice(5);
    expect(rms(output.map((point) => point.x))).toBeLessThanOrEqual(1.5);
  });

  it("reduces seeded random stationary noise on both axes", () => {
    let seed = 42;
    const noise = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed / 2 ** 32 - 0.5) * 8;
    };
    const points = Array.from({ length: 120 }, () => ({
      x: noise(),
      y: noise(),
    }));
    const output = trace(points).slice(5);
    expect(
      rms(output.map((point) => Math.hypot(point.x, point.y))),
    ).toBeLessThan(
      rms(points.slice(5).map((point) => Math.hypot(point.x, point.y))),
    );
  });

  it.each([5, 10, 50])(
    "bounds straight walking lag at reported accuracy %s",
    (accuracy) => {
      const points = Array.from({ length: 31 }, (_, index) => ({
        x: index * 1.4,
        y: 0,
      }));
      const output = trace(points, accuracy);
      expect(distance(output.at(-1)!, points.at(-1)!)).toBeLessThan(
        accuracy === 5 ? 1.5 : 2.5,
      );
    },
  );

  it.each([5, 10, 50])(
    "settles after stopping and follows a right-angle turn at accuracy %s",
    (accuracy) => {
      const walking = Array.from({ length: 31 }, (_, index) => ({
        x: index * 1.4,
        y: 0,
      }));
      const stopped = [
        ...walking,
        ...Array.from({ length: 4 }, () => ({ x: 42, y: 0 })),
      ];
      expect(
        distance(trace(stopped, accuracy).at(-1)!, { x: 42, y: 0 }),
      ).toBeLessThan(0.5);
      const turning = [
        ...walking,
        ...Array.from({ length: 5 }, (_, index) => ({
          x: 42,
          y: (index + 1) * 1.4,
        })),
      ];
      expect(
        distance(trace(turning, accuracy).at(-1)!, { x: 42, y: 7 }),
      ).toBeLessThan(3);
    },
  );

  it("does not claim to correct sustained bias or correlated drift", () => {
    const biased = Array.from({ length: 30 }, () => ({ x: 8, y: 0 }));
    expect(trace(biased).every((point) => point.x === 8)).toBe(true);
    const drifting = Array.from({ length: 30 }, (_, index) => ({
      x: Math.min(index * 0.5, 8),
      y: 0,
    }));
    expect(trace(drifting).at(-1)!.x).toBeGreaterThan(7.9);
  });

  it("weights reported accuracy but cannot identify confidently wrong readings", () => {
    function step(accuracy: number) {
      const smoother = new LocationSmoother();
      smoother.update(fixAt(0), { x: 0, y: 0 });
      return smoother.update(fixAt(1000, accuracy), { x: 8, y: 0 })!.x;
    }
    expect(step(1)).toBeGreaterThan(step(10));
    expect(step(1)).toBeGreaterThan(7);
    expect(step(0)).toBe(step(1));
  });

  it("uses actual acquisition intervals and resets only beyond five seconds", () => {
    const smoother = new LocationSmoother();
    const first = { x: 0, y: 0 };
    expect(smoother.update(fixAt(0), first)).toEqual(first);
    first.x = 999;
    const next = smoother.update(fixAt(250), { x: 10, y: 0 })!;
    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(2);
    expect(smoother.update(fixAt(5250), { x: 20, y: 0 })!.x).toBeLessThan(20);
    expect(smoother.update(fixAt(10251), { x: 30, y: 0 })).toEqual({
      x: 30,
      y: 0,
    });
    smoother.reset();
    expect(smoother.update(fixAt(11000), { x: 50, y: 0 })).toEqual({
      x: 50,
      y: 0,
    });
  });

  it("ignores duplicate, older, stale, future, invalid and uncalibrated inputs", () => {
    const smoother = new LocationSmoother();
    smoother.update(fixAt(1000), { x: 0, y: 0 });
    const invalid = [
      fixAt(1000),
      fixAt(500),
      fixAt(2000, -1),
      { ...fixAt(2000), receivedAt: 4001 },
      { ...fixAt(2000), receivedAt: 1999 },
      { ...fixAt(2000), accuracy: Infinity },
      { ...fixAt(2000), latitude: NaN },
      { ...fixAt(2000), longitude: 181 },
      { ...fixAt(2000), timestamp: NaN },
    ];
    for (const fix of invalid)
      expect(smoother.update(fix, { x: 99, y: 0 })).toBeNull();
    expect(smoother.update(fixAt(2000), null)).toBeNull();
    expect(smoother.update(fixAt(2000), { x: NaN, y: 0 })).toBeNull();
    const output = smoother.update(fixAt(2000), { x: 10, y: 0 })!;
    expect(output.x).toBeLessThan(4);
    const boundary = new LocationSmoother();
    expect(
      boundary.update({ ...fixAt(0), receivedAt: 2000 }, { x: 1, y: 2 }),
    ).toEqual({ x: 1, y: 2 });
  });
});
