// Experimental accuracy-adaptive EMA; its output has no validated uncertainty radius.
import { fresh, type Fix, type Point } from "../shared/recordingModel";

export const smoothingConfiguration = Object.freeze({
  algorithm: "accuracy-ema-v1",
  referenceAccuracyMetres: 5,
  minTimeConstantSeconds: 0.25,
  maxTimeConstantSeconds: 2,
  maxGapMs: 5000,
  maxAgeMs: 2000,
});
export type SmoothingConfiguration = typeof smoothingConfiguration;

export function eligibleFix(fix: Fix) {
  return (
    [
      fix.latitude,
      fix.longitude,
      fix.accuracy,
      fix.timestamp,
      fix.receivedAt,
    ].every(Number.isFinite) &&
    Math.abs(fix.latitude) <= 90 &&
    Math.abs(fix.longitude) <= 180 &&
    fix.accuracy >= 0 &&
    fresh(fix, fix.receivedAt, smoothingConfiguration.maxAgeMs)
  );
}

export class LocationSmoother {
  private previous: { point: Point; timestamp: number } | null = null;

  reset() {
    this.previous = null;
  }

  update(fix: Fix, raw: Point | null): Point | null {
    if (!eligibleFix(fix) || !raw || ![raw.x, raw.y].every(Number.isFinite))
      return null;
    const previous = this.previous;
    if (previous && fix.timestamp <= previous.timestamp) return null;
    let point = { ...raw };
    if (
      previous &&
      fix.timestamp - previous.timestamp <= smoothingConfiguration.maxGapMs
    ) {
      // Reported accuracy controls responsiveness, not a probability of being correct.
      const timeConstant = Math.min(
        smoothingConfiguration.maxTimeConstantSeconds,
        Math.max(
          smoothingConfiguration.minTimeConstantSeconds,
          fix.accuracy / smoothingConfiguration.referenceAccuracyMetres,
        ),
      );
      const weight = -Math.expm1(
        -(fix.timestamp - previous.timestamp) / 1000 / timeConstant,
      );
      point = {
        x: previous.point.x + weight * (raw.x - previous.point.x),
        y: previous.point.y + weight * (raw.y - previous.point.y),
      };
    }
    this.previous = { point, timestamp: fix.timestamp };
    return { ...point };
  }
}
