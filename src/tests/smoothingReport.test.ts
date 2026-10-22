// Missing/stale estimates cannot make success rates or paired comparisons look better.
import { describe, expect, it } from "vitest";
import { smoothingReport } from "../recordings/smoothingReport";

describe("fair smoothing comparison", () => {
  it("uses identical fresh pairs for both distributions and keeps every arrival in the denominator", () => {
    const summary = smoothingReport(true, [
      { fresh: true, rawApproxMetres: 8, smoothedApproxMetres: 4 },
      { fresh: true, rawApproxMetres: 1, smoothedApproxMetres: 2 },
      { fresh: false, rawApproxMetres: 0.1, smoothedApproxMetres: 0.1 },
      { fresh: true, rawApproxMetres: 99, smoothedApproxMetres: null },
      { fresh: false, rawApproxMetres: null, smoothedApproxMetres: null },
    ]);
    expect(summary.smoothedApproxAgreement).toMatchObject({
      under5FreshCount: 2,
      denominator: 5,
    });
    expect(summary.pairedApproxAgreement).toEqual({
      raw: { medianMetres: 1, p90Metres: 8 },
      smoothed: { medianMetres: 2, p90Metres: 4 },
      pairedCount: 2,
      excludedCount: 3,
    });
  });

  it("distinguishes unavailable legacy analysis from a new session with no measurable arrivals", () => {
    expect(smoothingReport(false, [])).toEqual({
      smoothedApproxAgreement: null,
      pairedApproxAgreement: null,
    });
    const enabled = smoothingReport(true, [
      { fresh: true, rawApproxMetres: NaN, smoothedApproxMetres: Infinity },
      { fresh: true, rawApproxMetres: null, smoothedApproxMetres: null },
    ]);
    expect(enabled.smoothedApproxAgreement).toEqual({
      medianMetres: null,
      p90Metres: null,
      under5FreshCount: 0,
      denominator: 2,
    });
    expect(enabled.pairedApproxAgreement).toMatchObject({
      pairedCount: 0,
      excludedCount: 2,
    });
  });
});
