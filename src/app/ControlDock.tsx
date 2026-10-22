// Displays reading freshness, actionable failures, and primary tracking controls.
import { messages, formatMessage, formatNumber } from "../locales";
import type { Prototype } from "./usePrototype";
export function ControlDock({ model }: { model: Prototype }) {
  const {
    map,
    position,
    now,
    busy,
    status,
    error,
    storageError,
    session,
    stop,
    start,
    setPicking,
  } = model;
  const isTracking = session?.status === "active";
  const readingAgeSeconds = position ? (now - position.timestamp) / 1000 : null;
  const isOutsideFloorPlan =
    position?.raw &&
    (position.raw.x < 0 ||
      position.raw.y < 0 ||
      position.raw.x > map.width ||
      position.raw.y > map.height);
  return (
    <section className="control-dock" aria-label={messages.app.trackingLabel}>
      <div className="tracking-status" role="status">
        {busy ? messages.app.acquiringAnchor : status}
      </div>
      <div className="reading-stats">
        <span>
          {messages.app.reportedAccuracy}{" "}
          <strong>
            {position
              ? formatMessage(messages.common.metres, {
                  value: formatNumber(position.accuracy),
                })
              : messages.common.unavailable}
          </strong>
        </span>
        <span>
          {messages.app.updated}{" "}
          <strong>
            {readingAgeSeconds === null
              ? messages.common.unavailable
              : formatMessage(messages.app.readingAge, {
                  seconds: formatNumber(Math.max(0, readingAgeSeconds), 1),
                })}
          </strong>
        </span>
      </div>
      {isOutsideFloorPlan && (
        <p className="warning">{messages.app.outsideDrawing}</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {storageError && (
        <p role="alert" className="error">
          {storageError}
        </p>
      )}
      <div className="dock-actions">
        <button className="primary" onClick={isTracking ? stop : start}>
          {isTracking ? messages.app.stopTracking : messages.app.startTracking}
        </button>
        <button
          disabled={!isTracking || !map.calibration || busy}
          onClick={() => setPicking("anchor")}
        >
          {messages.app.setStartingPoint}
        </button>
      </div>
    </section>
  );
}
