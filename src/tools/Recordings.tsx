// Saved recording summaries, exports, and deletion controls.
import {
  messages,
  formatMessage,
  formatDateTime,
  formatCount,
  formatPercent,
} from "../locales";
import type { Prototype } from "../app/usePrototype";
import { report } from "../recordings/recordingReport";
import { download } from "../recordings/recordingExport";
import { SmoothingSummary } from "./SmoothingSummary";
export function Recordings({ model }: { model: Prototype }) {
  const { session, history, deleteRecording } = model;
  return (
    <details>
      <summary>{messages.recordings.title}</summary>
      <div className="tool-section">
        <p>{messages.recordings.storageHint}</p>
        {!session && !history.length && <p>{messages.recordings.empty}</p>}
        {[
          ...(session ? [session] : []),
          ...history.filter((recording) => recording.id !== session?.id),
        ].map((recording) => {
          const summary = report(recording);
          return (
            <article className="record" key={recording.id}>
              <h3>{formatDateTime(recording.startedAt)}</h3>
              <p>
                {formatMessage(messages.recordings.summary, {
                  status: messages.recordings.status[recording.status],
                  readings: formatCount(
                    messages.recordings.readings,
                    recording.samples.length,
                  ),
                  arrivals: formatCount(
                    messages.recordings.arrivals,
                    summary.arrivalCount,
                  ),
                })}
              </p>
              <p>
                {formatMessage(messages.recordings.walkingFreshness, {
                  value:
                    summary.freshWalkingPercent === null
                      ? messages.common.unavailable
                      : formatPercent(summary.freshWalkingPercent),
                })}
              </p>
              <p>{summary.outcome}</p>
              <SmoothingSummary summary={summary} />
              <div className="record-actions">
                <button onClick={() => download(recording, "json")}>
                  {messages.recordings.exportJson}
                </button>
                <button onClick={() => download(recording, "csv")}>
                  {messages.recordings.exportCsv}
                </button>
                <button
                  disabled={recording.status === "active"}
                  onClick={() => deleteRecording(recording.id)}
                >
                  {messages.recordings.delete}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </details>
  );
}
