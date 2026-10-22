// Serializes complete recordings to CSV/JSON and triggers browser downloads.
import type { TestSession, PositionSample } from "../shared/recordingModel";
import { report } from "./recordingReport";
const header = [
  "record",
  "timestamp",
  "receivedAt",
  "latitude",
  "longitude",
  "reportedAccuracy",
  "rawX",
  "rawY",
  "correctedX",
  "correctedY",
  "anchorId",
  "detail",
  "smoothedX",
  "smoothedY",
];
function sampleRow(sample: PositionSample) {
  return [
    "sample",
    sample.timestamp,
    sample.receivedAt,
    sample.latitude,
    sample.longitude,
    sample.accuracy,
    sample.raw?.x,
    sample.raw?.y,
    sample.corrected?.x,
    sample.corrected?.y,
    sample.anchorId,
    sample.displayAccepted === undefined
      ? ""
      : JSON.stringify({ displayAccepted: sample.displayAccepted }),
    sample.smoothed?.x,
    sample.smoothed?.y,
  ];
}
function detailRow(
  kind: string,
  timestamp: number,
  anchorId: string | undefined | null,
  detail: unknown,
) {
  // JSON cells retain nested arrival snapshots and provenance in the flat CSV format.
  return [
    kind,
    timestamp,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    anchorId,
    JSON.stringify(detail),
    "",
    "",
  ];
}
function encodeRow(row: unknown[]) {
  return row
    .map((value) => '"' + String(value ?? "").replaceAll('"', '""') + '"')
    .join(",");
}
export function csv(session: TestSession) {
  const metadata = {
    notes: session.notes,
    userAgent: session.userAgent,
    floor: session.floor,
    smoothing: session.smoothing,
    report: report(session),
  };
  const rows = [
    header,
    ...session.samples.map(sampleRow),
    ...session.events.map((event) =>
      detailRow(event.type, event.at, event.anchorId, event),
    ),
    ...session.anchors.map((anchor) =>
      detailRow("anchor", anchor.at, anchor.id, anchor),
    ),
    detailRow("metadata", session.startedAt, "", metadata),
  ];
  return rows.map(encodeRow).join("\r\n");
}
export function download(session: TestSession, format: "json" | "csv") {
  const data =
    format === "json"
      ? JSON.stringify({ ...session, report: report(session) }, null, 2)
      : csv(session);
  const url = URL.createObjectURL(
    new Blob([data], {
      type: format === "json" ? "application/json" : "text/csv",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `se12-${session.id}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
