// Official GIS corner correspondences and initial cropped-floor configuration.
import { messages } from "../locales";
import { calibrate, floor, type FloorMap } from "../shared/recordingModel";
// Main rectangular building corners, excluding protruding stairwells and links.
// PDF north points left: image upper-right = geographic southeast.
export const calibrationInput = {
  source: messages.map.calibrationSource,
  controls: [
    {
      label: messages.map.calibrationLandmarks.northwest,
      latitude: 49.2504715666189,
      longitude: -123.001755908749,
      x: 115,
      y: 704,
    },
    {
      label: messages.map.calibrationLandmarks.southeast,
      latitude: 49.2494375079103,
      longitude: -123.001426553242,
      x: 2795,
      y: 148,
    },
    {
      label: messages.map.calibrationLandmarks.southwest,
      latitude: 49.2494387932512,
      longitude: -123.001758816794,
      x: 2795,
      y: 704,
    },
    {
      label: messages.map.calibrationLandmarks.northeast,
      latitude: 49.2504690666971,
      longitude: -123.001441208812,
      x: 115,
      y: 148,
    },
  ],
};
export const initialCalibration = {
  ...calibrate(calibrationInput.controls, calibrationInput.source),
  version: "bcit-se12-footprint-2026-10-22-v1",
};

export const prototypeFloor: FloorMap = {
  ...floor,
  calibration: initialCalibration,
  height: 887,
  // Drawing-based candidates in the cropped raster's pixels, pending physical confirmation.
  checkpoints: floor.checkpoints.map((checkpoint, checkpointIndex) => ({
    ...checkpoint,
    ...[
      { x: 124, y: 420 },
      { x: 311, y: 155 },
      { x: 1244, y: 155 },
      { x: 1244, y: 420 },
      { x: 1244, y: 669 },
      { x: 1804, y: 155 },
      { x: 2131, y: 482 },
      { x: 1944, y: 669 },
    ][checkpointIndex],
  })),
};
