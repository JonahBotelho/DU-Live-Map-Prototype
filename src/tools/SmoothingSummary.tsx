// Paired arrival summaries use the same observations for both position estimates.
import { messages, formatMessage, formatNumber } from "../locales";
import type { report } from "../recordings/recordingReport";

export function SmoothingSummary({
  summary,
}: {
  summary: ReturnType<typeof report>;
}) {
  const paired = summary.pairedApproxAgreement;
  const smoothed = summary.smoothedApproxAgreement;
  if (!paired || !smoothed)
    return <p>{messages.recordings.smoothingUnavailable}</p>;
  const metres = (value: number | null) =>
    value === null
      ? messages.common.unavailable
      : formatMessage(messages.common.metres, {
          value: formatNumber(value, 2),
        });
  return (
    <>
      <p>
        {formatMessage(messages.recordings.smoothingSuccess, {
          count: formatNumber(smoothed.under5FreshCount),
          total: formatNumber(smoothed.denominator),
        })}
      </p>
      <p>
        {formatMessage(messages.recordings.smoothingPairs, {
          count: formatNumber(paired.pairedCount),
          excluded: formatNumber(paired.excludedCount),
          rawMedian: metres(paired.raw.medianMetres),
          rawP90: metres(paired.raw.p90Metres),
          smoothedMedian: metres(paired.smoothed.medianMetres),
          smoothedP90: metres(paired.smoothed.p90Metres),
        })}
      </p>
    </>
  );
}
