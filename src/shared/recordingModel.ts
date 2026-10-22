// Recording types, baseline floor metadata, and immutable sample/anchor construction.
import { messages } from "../locales";
import { project } from "../map/floorPlanGeometry";
export {
  local,
  project,
  distance,
  scale,
  calibrate,
} from "../map/floorPlanGeometry";
export type Point = { x: number; y: number };
export type Fix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  // Acquisition and receipt can differ; freshness must use the acquisition time.
  timestamp: number;
  receivedAt: number;
};
export type Control = Point & {
  latitude: number;
  longitude: number;
  label: string;
};
export type Calibration = {
  version: string;
  source: string;
  controls: Control[];
  origin: { latitude: number; longitude: number };
  a: number;
  b: number;
  tx: number;
  ty: number;
  residuals: number[];
  checkResidual: number;
  status: "approximate";
};
export type FloorMap = {
  id: string;
  image: string;
  width: number;
  height: number;
  calibration: Calibration | null;
  checkpoints: (Point & { id: string; label: string })[];
};
export type Anchor = {
  id: string;
  at: number;
  point: Point;
  fix: Fix;
  offset: Point;
  endedAt?: number;
};
export type PositionSample = Fix & {
  id: string;
  raw: Point | null;
  corrected: Point | null;
  anchorId: string | null;
};
export type Event = {
  at: number;
  type: string;
  detail?: string;
  checkpointId?: string;
  sample?: PositionSample | null;
  anchorId?: string | null;
};
export type TestSession = {
  schemaVersion: 1;
  id: string;
  startedAt: number;
  endedAt?: number;
  status: "active" | "stopped" | "interrupted";
  notes: string;
  userAgent: string;
  floor: FloorMap;
  samples: PositionSample[];
  anchors: Anchor[];
  events: Event[];
};
export const floor: FloorMap = {
  id: "SE12-3",
  image: "/floor.png",
  width: 2800,
  height: 900,
  calibration: null,
  checkpoints: [
    { id: "A", label: messages.map.checkpoints.A, x: 145, y: 445 },
    { id: "B", label: messages.map.checkpoints.B, x: 305, y: 84 },
    { id: "C", label: messages.map.checkpoints.C, x: 1050, y: 84 },
    { id: "D", label: messages.map.checkpoints.D, x: 1185, y: 380 },
    { id: "E", label: messages.map.checkpoints.E, x: 1185, y: 620 },
    { id: "F", label: messages.map.checkpoints.F, x: 1810, y: 84 },
    { id: "G", label: messages.map.checkpoints.G, x: 2110, y: 430 },
    { id: "H", label: messages.map.checkpoints.H, x: 1970, y: 620 },
  ],
};
export const fresh = (locationFix: Fix, now: number, maxAgeMs = 2000) =>
  now - locationFix.timestamp >= 0 && now - locationFix.timestamp <= maxAgeMs;
export function sample(
  locationFix: Fix,
  calibration: Calibration | null,
  startingAnchor: Anchor | null,
): PositionSample {
  const raw = calibration ? project(locationFix, calibration) : null;
  // Retain the original fix and accuracy so correction cannot hide sensor error.
  return {
    ...locationFix,
    id: crypto.randomUUID(),
    raw,
    corrected:
      raw && startingAnchor
        ? {
            x: raw.x + startingAnchor.offset.x,
            y: raw.y + startingAnchor.offset.y,
          }
        : null,
    anchorId: startingAnchor?.id ?? null,
  };
}
export function anchor(
  point: Point,
  fix: Fix,
  calibration: Calibration,
  now: number,
): Anchor {
  if (!fresh(fix, now)) throw Error(messages.errors.staleAnchor);
  const rawPosition = project(fix, calibration);
  return {
    id: crypto.randomUUID(),
    at: now,
    point,
    fix,
    offset: { x: point.x - rawPosition.x, y: point.y - rawPosition.y },
  };
}
export function createSession(map: FloorMap, notes: string): TestSession {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    status: "active",
    notes,
    userAgent: navigator.userAgent,
    // Later calibration edits must not change the interpretation of this recording.
    floor: structuredClone(map),
    samples: [],
    anchors: [],
    events: [],
  };
}
