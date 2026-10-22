// Local geographic projection and similarity fitting for the floor-plan overlay.
import { messages } from "../locales";
import type { Point, Control, Calibration } from "../shared/recordingModel";
function fitSimilarity(localPoints: Point[], imagePoints: Point[]) {
  // Center the points to fit rotation and uniform scale independently of translation.
  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const localCenterX = mean(localPoints.map((point) => point.x)),
    localCenterY = mean(localPoints.map((point) => point.y)),
    imageCenterX = mean(imagePoints.map((point) => point.x)),
    imageCenterY = mean(imagePoints.map((point) => point.y));
  let squaredDistanceSum = 0,
    scaleRotationNumerator = 0,
    crossRotationNumerator = 0;
  localPoints.forEach((point, index) => {
    const localOffsetX = point.x - localCenterX,
      localOffsetY = point.y - localCenterY,
      imageOffsetX = imagePoints[index].x - imageCenterX,
      imageOffsetY = imagePoints[index].y - imageCenterY;
    squaredDistanceSum +=
      localOffsetX * localOffsetX + localOffsetY * localOffsetY;
    scaleRotationNumerator +=
      localOffsetX * imageOffsetX - localOffsetY * imageOffsetY;
    crossRotationNumerator +=
      localOffsetY * imageOffsetX + localOffsetX * imageOffsetY;
  });
  const scaleRotation = scaleRotationNumerator / squaredDistanceSum,
    crossRotation = crossRotationNumerator / squaredDistanceSum;
  if (Math.hypot(scaleRotation, crossRotation) < 0.001)
    throw Error(messages.errors.degenerateCoordinates);
  // Retain the existing coefficient keys for saved calibration and exported recordings.
  return {
    a: scaleRotation,
    b: crossRotation,
    tx:
      imageCenterX -
      scaleRotation * localCenterX -
      crossRotation * localCenterY,
    ty:
      imageCenterY -
      crossRotation * localCenterX +
      scaleRotation * localCenterY,
  };
}
const earthRadiusMetres = 6371008.8,
  radiansPerDegree = Math.PI / 180;
// A local flat-earth approximation is sufficient over this building's footprint.
export function local(
  coordinates: { latitude: number; longitude: number },
  origin: { latitude: number; longitude: number },
): Point {
  return {
    x:
      earthRadiusMetres *
      (coordinates.longitude - origin.longitude) *
      radiansPerDegree *
      Math.cos(origin.latitude * radiansPerDegree),
    y:
      earthRadiusMetres *
      (coordinates.latitude - origin.latitude) *
      radiansPerDegree,
  };
}
export function project(
  coordinates: { latitude: number; longitude: number },
  calibration: Calibration,
): Point {
  const localPoint = local(coordinates, calibration.origin);
  // Geographic north is positive y, while image y increases downward.
  return {
    x:
      calibration.a * localPoint.x +
      calibration.b * localPoint.y +
      calibration.tx,
    y:
      calibration.b * localPoint.x -
      calibration.a * localPoint.y +
      calibration.ty,
  };
}
export const distance = (firstPoint: Point, secondPoint: Point) =>
  Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y);
export const scale = (calibration: Calibration) =>
  Math.hypot(calibration.a, calibration.b);
function validateControls(controls: Control[], source: string) {
  if (controls.length !== 4 || !source.trim())
    throw Error(messages.errors.controlCount);
  for (const control of controls)
    if (
      ![control.x, control.y, control.latitude, control.longitude].every(
        Number.isFinite,
      ) ||
      Math.abs(control.latitude) > 90 ||
      Math.abs(control.longitude) > 180
    )
      throw Error(messages.errors.invalidCoordinates);
}
export function calibrate(controls: Control[], source: string): Calibration {
  validateControls(controls, source);
  const origin = {
    latitude: controls[0].latitude,
    longitude: controls[0].longitude,
  };
  // Keep the fourth landmark out of the fit so its residual is an independent check.
  const fitControls = controls.slice(0, 3),
    localControls = fitControls.map((control) => local(control, origin));
  if (
    Math.abs(
      (localControls[1].x - localControls[0].x) *
        (localControls[2].y - localControls[0].y) -
        (localControls[1].y - localControls[0].y) *
          (localControls[2].x - localControls[0].x),
    ) < 1
  )
    throw Error(messages.errors.collinearControls);
  const transform = fitSimilarity(localControls, fitControls);
  const calibration: Calibration = {
    version: crypto.randomUUID(),
    source,
    controls,
    origin,
    ...transform,
    residuals: [],
    checkResidual: 0,
    status: "approximate",
  };
  // Convert pixel discrepancies to approximate metres; these are not GPS accuracy measurements.
  calibration.residuals = fitControls.map(
    (control) =>
      distance(control, project(control, calibration)) / scale(calibration),
  );
  calibration.checkResidual =
    distance(controls[3], project(controls[3], calibration)) /
    scale(calibration);
  return calibration;
}
