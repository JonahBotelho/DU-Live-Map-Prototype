// Compare identical fresh arrivals; missing estimates remain in the success denominator.
export type SmoothingCheckpoint = {
  fresh: boolean;
  rawApproxMetres: number | null;
  smoothedApproxMetres: number | null;
};
const finite = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);
function distribution(values: number[]) {
  const sorted = [...values].sort((first, second) => first - second);
  const percentile = (fraction: number) =>
    sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1] : null;
  return { medianMetres: percentile(0.5), p90Metres: percentile(0.9) };
}
export function smoothingReport(
  enabled: boolean,
  checkpoints: SmoothingCheckpoint[],
) {
  if (!enabled)
    return { smoothedApproxAgreement: null, pairedApproxAgreement: null };
  const measurable = checkpoints.filter((point) =>
    finite(point.smoothedApproxMetres),
  );
  const paired = checkpoints.filter(
    (point) =>
      point.fresh &&
      finite(point.rawApproxMetres) &&
      finite(point.smoothedApproxMetres),
  );
  return {
    smoothedApproxAgreement: {
      ...distribution(measurable.map((point) => point.smoothedApproxMetres!)),
      under5FreshCount: measurable.filter(
        (point) => point.fresh && point.smoothedApproxMetres! < 5,
      ).length,
      denominator: checkpoints.length,
    },
    pairedApproxAgreement: {
      raw: distribution(paired.map((point) => point.rawApproxMetres!)),
      smoothed: distribution(
        paired.map((point) => point.smoothedApproxMetres!),
      ),
      pairedCount: paired.length,
      excludedCount: checkpoints.length - paired.length,
    },
  };
}
