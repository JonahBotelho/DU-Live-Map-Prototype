// Regression checks for geometry, location lifecycle, recording exports, and persistence.
import { describe, it, expect, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  local,
  calibrate,
  project,
  anchor,
  sample,
  fresh,
  type Control,
  type TestSession,
  floor,
} from "../shared/recordingModel";
import { BrowserLocation } from "../tracking/browserLocation";
import { save, recover, remove, all } from "../recordings/recordingStorage";
import { report } from "../recordings/recordingReport";
import { csv } from "../recordings/recordingExport";
import { initialCalibration } from "../map/floorPlanCalibration";
const origin = { latitude: 49.25, longitude: -123 };
const controls: Control[] = [
  { ...origin, x: 100, y: 200, label: "a" },
  { latitude: 49.25, longitude: -122.999, x: 0, y: 0, label: "b" },
  { latitude: 49.251, longitude: -123, x: 0, y: 0, label: "c" },
  { latitude: 49.251, longitude: -122.999, x: 0, y: 0, label: "check" },
].map((control) => {
  const localPoint = local(control, origin);
  return {
    ...control,
    x: 100 + 2 * localPoint.x + 0.5 * localPoint.y,
    y: 200 + 0.5 * localPoint.x - 2 * localPoint.y,
  };
});
const calibration = calibrate(
  controls,
  "independent synthetic unit-test fixture",
);
const locationFix = {
  ...origin,
  accuracy: 10,
  altitude: null,
  heading: null,
  speed: null,
  timestamp: 1000,
  receivedAt: 1100,
};
describe("geometry and correction", () => {
  it("keeps the real public-map held-out corner independent and approximate", () => {
    expect(initialCalibration.controls).toHaveLength(4);
    expect(initialCalibration.residuals).toHaveLength(3);
    expect(initialCalibration.status).toBe("approximate");
    expect(initialCalibration.checkResidual).toBeGreaterThan(1);
    expect(initialCalibration.checkResidual).toBeLessThan(1.2);
  });
  it("preserves uniform scale and y-down orientation", () => {
    expect(calibration.a).toBeCloseTo(2);
    expect(calibration.b).toBeCloseTo(0.5);
    expect(calibration.checkResidual).toBeLessThan(1e-8);
    expect(project(origin, calibration)).toEqual({ x: 100, y: 200 });
  });
  it("rejects invalid and collinear controls", () => {
    expect(() => calibrate([], "")).toThrow();
    expect(() =>
      calibrate([controls[0], controls[0], controls[0], controls[3]], "x"),
    ).toThrow();
  });
  it("preserves raw readings when applying a fixed offset", () => {
    const startingAnchor = anchor(
        { x: 200, y: 300 },
        locationFix,
        calibration,
        1500,
      ),
      positionSample = sample(locationFix, calibration, startingAnchor);
    expect(positionSample.raw).toEqual({ x: 100, y: 200 });
    expect(positionSample.corrected).toEqual({ x: 200, y: 300 });
    expect(positionSample.accuracy).toBe(10);
  });
  it("rejects stale and future anchors", () => {
    expect(() =>
      anchor({ x: 1, y: 2 }, locationFix, calibration, 4001),
    ).toThrow();
    expect(fresh(locationFix, 999)).toBe(false);
  });
  it("retains uncalibrated samples without manufactured map positions", () =>
    expect(sample(locationFix, null, null).raw).toBeNull());
});
describe("location lifecycle", () => {
  it("has one subscription and suppresses late callbacks", () => {
    let success: PositionCallback = () => {};
    let failure: PositionErrorCallback | null | undefined;
    const geolocation = {
      watchPosition: vi.fn((onSuccess, onError) => {
        success = onSuccess;
        failure = onError;
        return 3;
      }),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn(),
    } as unknown as Geolocation;
    const locationProvider = new BrowserLocation(geolocation),
      onReading = vi.fn(),
      error = vi.fn();
    locationProvider.start(onReading, error);
    const previousSuccessCallback = success;
    locationProvider.start(onReading, error);
    previousSuccessCallback({
      coords: locationFix,
      timestamp: 1000,
    } as unknown as GeolocationPosition);
    expect(onReading).not.toHaveBeenCalled();
    success({
      coords: locationFix,
      timestamp: 1000,
    } as unknown as GeolocationPosition);
    expect(onReading).toHaveBeenCalledTimes(1);
    failure?.({ code: 1 } as GeolocationPositionError);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("denied"));
    locationProvider.stop();
    success({
      coords: locationFix,
      timestamp: 1000,
    } as unknown as GeolocationPosition);
    expect(onReading).toHaveBeenCalledTimes(1);
    expect(geolocation.clearWatch).toHaveBeenCalledTimes(2);
  });
});
function session(): TestSession {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    startedAt: 1000,
    status: "active",
    notes: 'a,"b"\n',
    userAgent: "test",
    floor,
    samples: [sample(locationFix, null, null)],
    anchors: [],
    events: [],
  };
}
describe("records and analysis", () => {
  it("keeps immutable arrival snapshots and missing arrivals in denominator", () => {
    const recording = session();
    recording.endedAt = 5000;
    recording.events.push(
      {
        at: 1200,
        type: "arrival",
        sample: structuredClone(recording.samples[0]),
      },
      { at: 4000, type: "arrival", sample: null },
    );
    recording.samples.push(
      sample({ ...locationFix, timestamp: 4100, receivedAt: 4200 }, null, null),
    );
    expect(recording.events[0].sample?.timestamp).toBe(1000);
    expect(report(recording).arrivalCount).toBe(2);
    expect(report(recording).freshArrivals).toBe(1);
    const metadataRow = csv(recording).split("\r\n").at(-1)!;
    const field = metadataRow
      .replace(/,"",""$/, "")
      .slice(metadataRow.indexOf('"{') + 1, -1)
      .replaceAll('""', '"');
    expect(JSON.parse(field).notes).toBe(recording.notes);
  });
  it("persists, recovers interrupted work, and deletes", async () => {
    const recording = session();
    await save(recording);
    const sessions = await recover();
    expect(
      sessions.find((savedSession) => savedSession.id === recording.id)?.status,
    ).toBe("interrupted");
    await remove(recording.id);
    expect(
      (await all()).find((savedSession) => savedSession.id === recording.id),
    ).toBeUndefined();
  });
  it("rejects storage access failures", async () => {
    const spy = vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw Error("disk denied");
    });
    await expect(save(session())).rejects.toThrow("disk denied");
    spy.mockRestore();
  });
});
