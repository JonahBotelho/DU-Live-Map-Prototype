// Display choice does not affect the filter, source timestamps, or manual correction.
import { messages } from "../locales";
import {
  fresh,
  type DisplayMode,
  type PositionSample,
} from "../shared/recordingModel";

export function PositionDisplayControls({
  position,
  now,
  displayMode,
  onChange,
}: {
  position: PositionSample | null;
  now: number;
  displayMode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}) {
  return (
    <div className="position-display">
      <div
        role="group"
        aria-label={messages.app.positionDisplay}
        className="position-toggle"
      >
        {(["raw", "smoothed"] as const).map((mode) => (
          <button
            key={mode}
            aria-pressed={displayMode === mode}
            onClick={() => onChange(mode)}
          >
            {messages.app.positionModes[mode]}
          </button>
        ))}
      </div>
      <div role="status">
        {displayMode === "smoothed" && (
          <p>{messages.app.smoothedUncertainty}</p>
        )}
        {displayMode === "smoothed" && !position?.smoothed && (
          <p>{messages.app.smoothedWaiting}</p>
        )}
        {/* The display timer can lag a newly received fix by up to one tick. */}
        {position && !fresh(position, Math.max(now, position.receivedAt)) && (
          <p className="warning">{messages.app.stalePosition}</p>
        )}
      </div>
    </div>
  );
}
