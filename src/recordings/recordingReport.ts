// Summarizes arrival observations, stationary drift, and time-weighted freshness.
import { messages } from "../locales";
import { smoothingReport } from "./smoothingReport";
import {
  distance,
  fresh,
  scale,
  local,
  type TestSession,
  type Event,
} from "../shared/recordingModel";
const percentile = (values: number[], fraction: number) =>
  values.length
    ? [...values].sort((firstValue, secondValue) => firstValue - secondValue)[
        Math.max(0, Math.ceil(values.length * fraction) - 1)
      ]
    : null;
function walkingCoverage(session: TestSession, end: number) {
  let walking = 0,
    covered = 0;
  let moving = true;
  let initializing = false;
  let sampleIndex = 0,
    eventIndex = 0,
    latestSample: (typeof session.samples)[number] | undefined;
  // Weight coverage by elapsed time, not callback count; hidden walking gaps still count.
  for (let timestamp = session.startedAt; timestamp < end; timestamp += 1000) {
    while (
      eventIndex < session.events.length &&
      session.events[eventIndex].at <= timestamp
    ) {
      if (session.events[eventIndex].type === "arrival") moving = false;
      if (session.events[eventIndex].type === "departure") moving = true;
      if (session.events[eventIndex].type === "anchor-start")
        initializing = true;
      if (
        ["anchor-set", "anchor-failed", "hidden", "stop"].includes(
          session.events[eventIndex].type,
        )
      )
        initializing = false;
      eventIndex++;
    }
    // Never credit a fix before the app actually received it, even if acquisition was earlier.
    while (
      sampleIndex < session.samples.length &&
      session.samples[sampleIndex].receivedAt <= timestamp
    ) {
      const reading = session.samples[sampleIndex++];
      // Rejected callbacks remain recorded but never replaced the observed map position.
      // Undefined preserves the interpretation of recordings made before this field existed.
      if (reading.displayAccepted !== false) latestSample = reading;
    }
    if (moving && !initializing) {
      walking++;
      if (latestSample && fresh(latestSample, timestamp)) covered++;
    }
  }
  return { walking, covered };
}
function checkpointResult(session: TestSession, sessionEvent: Event) {
  const checkpoint = session.floor.checkpoints.find(
    (candidate) => candidate.id === sessionEvent.checkpointId,
  );
  const calibration = session.floor.calibration;
  return {
    at: sessionEvent.at,
    checkpoint: sessionEvent.checkpointId,
    displayMode: sessionEvent.displayMode ?? null,
    fresh: !!sessionEvent.sample && fresh(sessionEvent.sample, sessionEvent.at),
    rawApproxMetres:
      checkpoint && calibration && sessionEvent.sample?.raw
        ? distance(checkpoint, sessionEvent.sample.raw) / scale(calibration)
        : null,
    correctedApproxMetres:
      checkpoint && calibration && sessionEvent.sample?.corrected
        ? distance(checkpoint, sessionEvent.sample.corrected) /
          scale(calibration)
        : null,
    smoothedApproxMetres:
      checkpoint && calibration && sessionEvent.sample?.smoothed
        ? distance(checkpoint, sessionEvent.sample.smoothed) /
          scale(calibration)
        : null,
    observation: sessionEvent.detail,
  };
}
function stationaryResult(
  session: TestSession,
  sessionEvent: Event,
  end: number,
) {
  const departure = session.events.find(
    (candidateEvent) =>
      candidateEvent.type === "departure" &&
      candidateEvent.at > sessionEvent.at,
  );
  const until = departure?.at ?? end;
  const readings = session.samples.filter(
    (reading) =>
      reading.receivedAt >= sessionEvent.at &&
      reading.receivedAt < until &&
      reading.timestamp >= sessionEvent.at,
  );
  // Cached copies are retained in exports but must not inflate distinct stationary fixes.
  const unique = readings.filter(
    (reading, sampleIndex) =>
      readings.findIndex(
        (candidateReading) => candidateReading.timestamp === reading.timestamp,
      ) === sampleIndex,
  );
  const first = unique[0];
  const drift = first
    ? unique.map((reading) =>
        Math.hypot(...Object.values(local(reading, first))),
      )
    : [];
  return {
    checkpoint: sessionEvent.checkpointId,
    seconds: (until - sessionEvent.at) / 1000,
    distinctFixes: unique.length,
    maxDisplacementFromFirstMetres: drift.length ? Math.max(...drift) : null,
  };
}
function agreementSummary(
  arrivals: Event[],
  checkpoints: ReturnType<typeof checkpointResult>[],
) {
  // Percentiles use measurable visits; success denominators below still include missing fixes.
  const rawErrors = checkpoints.flatMap((checkpoint) =>
    checkpoint.rawApproxMetres === null ? [] : [checkpoint.rawApproxMetres],
  );
  const correctedEligible = checkpoints.filter(
    (checkpoint) => checkpoint.correctedApproxMetres !== null,
  );
  const correctedErrors = correctedEligible.map(
    (checkpoint) => checkpoint.correctedApproxMetres!,
  );
  return {
    rawApproxAgreement: {
      medianMetres: percentile(rawErrors, 0.5),
      p90Metres: percentile(rawErrors, 0.9),
      under5FreshCount: checkpoints.filter(
        (checkpoint) =>
          checkpoint.fresh &&
          checkpoint.rawApproxMetres !== null &&
          checkpoint.rawApproxMetres < 5,
      ).length,
      denominator: arrivals.length,
    },
    correctedApproxAgreement: {
      medianMetres: percentile(correctedErrors, 0.5),
      p90Metres: percentile(correctedErrors, 0.9),
      under5FreshCount: correctedEligible.filter(
        (checkpoint) =>
          checkpoint.fresh && checkpoint.correctedApproxMetres! < 5,
      ).length,
      eligibleVisits: arrivals.filter((sessionEvent) => !!sessionEvent.anchorId)
        .length,
    },
  };
}
export function report(session: TestSession) {
  const arrivals = session.events.filter(
    (sessionEvent) => sessionEvent.type === "arrival",
  );
  const gaps = session.samples
    .slice(1)
    .map(
      (reading, sampleIndex) =>
        reading.receivedAt - session.samples[sampleIndex].receivedAt,
    );
  const end = session.endedAt ?? Date.now();
  const { walking, covered } = walkingCoverage(session, end);
  const checkpoints = arrivals.map((sessionEvent) =>
    checkpointResult(session, sessionEvent),
  );
  const stationary = arrivals.map((sessionEvent) =>
    stationaryResult(session, sessionEvent, end),
  );
  return {
    outcome: messages.recordings.inconclusive,
    arrivalCount: arrivals.length,
    freshArrivals: checkpoints.filter((checkpoint) => checkpoint.fresh).length,
    walkingSeconds: walking,
    freshWalkingPercent: walking ? (100 * covered) / walking : null,
    firstFixMs: session.samples.length
      ? session.samples[0].receivedAt - session.startedAt
      : null,
    maxUpdateGapMs: gaps.length ? Math.max(...gaps) : null,
    medianUpdateGapMs: percentile(gaps, 0.5),
    p90UpdateGapMs: percentile(gaps, 0.9),
    ...agreementSummary(arrivals, checkpoints),
    ...smoothingReport(!!session.smoothing, checkpoints),
    stationary,
    wrongHallwayArrivals: arrivals.filter(
      (sessionEvent) => sessionEvent.detail === "wrong hallway",
    ).length,
    interruptions: session.events.filter(
      (sessionEvent) =>
        sessionEvent.type === "hidden" || sessionEvent.type === "reload",
    ).length,
    checkpoints,
  };
}
