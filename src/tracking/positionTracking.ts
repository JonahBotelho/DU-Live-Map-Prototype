// Keeps recorded callbacks separate from the latest eligible displayed observation.
import {
  sample,
  type Fix,
  type Calibration,
  type Anchor,
  type PositionSample,
  type DisplayMode,
  type Event,
} from "../shared/recordingModel";
import { eligibleFix, LocationSmoother } from "./locationSmoothing";

export class PositionTracking {
  current: PositionSample | null = null;
  mode: DisplayMode = "raw";
  private smoother = new LocationSmoother();
  private latestTimestamp = -Infinity;

  reset(clearPosition = false) {
    this.smoother.reset();
    if (clearPosition) {
      this.current = null;
      this.latestTimestamp = -Infinity;
    }
  }

  record(fix: Fix, calibration: Calibration | null, anchor: Anchor | null) {
    const reading = sample(fix, calibration, anchor);
    reading.smoothed = null;
    reading.displayAccepted = false;
    const validProjection =
      !calibration ||
      (!!reading.raw && [reading.raw.x, reading.raw.y].every(Number.isFinite));
    if (
      !eligibleFix(fix) ||
      !validProjection ||
      fix.timestamp <= this.latestTimestamp
    )
      return reading;
    reading.smoothed = this.smoother.update(fix, reading.raw);
    reading.displayAccepted = true;
    this.latestTimestamp = fix.timestamp;
    this.current = reading;
    return reading;
  }

  clearCorrection() {
    if (this.current)
      this.current = { ...this.current, corrected: null, anchorId: null };
  }

  arrivalSnapshot(): Pick<Event, "sample" | "displayMode"> {
    return { sample: structuredClone(this.current), displayMode: this.mode };
  }
}

export const phonePosition = (
  position: PositionSample | null,
  mode: DisplayMode,
) => (mode === "smoothed" ? position?.smoothed : position?.raw) ?? null;

export const followPosition = (
  position: PositionSample | null,
  mode: DisplayMode,
) => position?.corrected ?? phonePosition(position, mode);
