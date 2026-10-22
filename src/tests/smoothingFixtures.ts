// Synthetic map coordinates have unit scale, so fixture distances are metres.
import { initialCalibration } from "../map/floorPlanCalibration";
import type { Fix, Point } from "../shared/recordingModel";
export const testCalibration = {
  ...initialCalibration,
  a: 1,
  b: 0,
  tx: 0,
  ty: 0,
  origin: { latitude: 49.25, longitude: -123 },
};
export function fixAt(
  timestamp: number,
  accuracy = 10,
  point: Point = { x: 0, y: 0 },
): Fix {
  const metresPerDegree = (6371008.8 * Math.PI) / 180;
  return {
    latitude: testCalibration.origin.latitude - point.y / metresPerDegree,
    longitude:
      testCalibration.origin.longitude +
      point.x /
        (metresPerDegree *
          Math.cos((testCalibration.origin.latitude * Math.PI) / 180)),
    accuracy,
    timestamp,
    receivedAt: timestamp + 100,
    altitude: null,
    heading: null,
    speed: null,
  };
}
