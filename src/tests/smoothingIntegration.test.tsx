// Check display selection, arrival fairness and backwards-compatible persistence/exports.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import "fake-indexeddb/auto";
import {
  PositionTracking,
  phonePosition,
  followPosition,
} from "../tracking/positionTracking";
import { smoothingConfiguration } from "../tracking/locationSmoothing";
import {
  anchor,
  floor,
  sample,
  type TestSession,
} from "../shared/recordingModel";
import { report } from "../recordings/recordingReport";
import { csv, download } from "../recordings/recordingExport";
import { save, all, remove } from "../recordings/recordingStorage";
import { MapMarkers } from "../map/MapMarkers";
import { PositionDisplayControls } from "../app/PositionDisplayControls";
import { SmoothingSummary } from "../tools/SmoothingSummary";
import { messages } from "../locales";
import { fixAt, testCalibration } from "./smoothingFixtures";

const map = {
  ...floor,
  calibration: testCalibration,
  checkpoints: [{ id: "A", label: "fixture", x: 0, y: 0 }],
};
function session(smoothing = true): TestSession {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    status: "stopped",
    startedAt: 0,
    endedAt: 10000,
    notes: 'test,"quoted"\nnotes',
    userAgent: "test",
    floor: map,
    samples: [],
    anchors: [],
    events: [],
    ...(smoothing ? { smoothing: { ...smoothingConfiguration } } : {}),
  };
}
// Parse quoted fields, including embedded commas, quotes and newlines in JSON detail cells.
function csvRows(content: string) {
  const rows: string[][] = [[]];
  let field = "",
    quoted = false;
  for (let index = 0; index < content.length; index++) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && (character === "," || character === "\r")) {
      rows.at(-1)!.push(field);
      field = "";
      if (character === "\r") {
        rows.push([]);
        index++;
      }
    } else field += character;
  }
  rows.at(-1)!.push(field);
  return rows;
}

describe("position tracking integration", () => {
  it("defaults to raw, computes both views, and snapshots a toggle without a new fix", () => {
    const tracking = new PositionTracking();
    const first = tracking.record(fixAt(0), testCalibration, null);
    const next = tracking.record(
      fixAt(1000, 10, { x: 8, y: 0 }),
      testCalibration,
      null,
    );
    expect(tracking.mode).toBe("raw");
    expect(first.raw).toEqual(first.smoothed);
    expect(next.raw!.x).toBeCloseTo(8);
    expect(next.smoothed!.x).toBeLessThan(4);
    const rawArrival = tracking.arrivalSnapshot();
    tracking.mode = "smoothed";
    const smoothArrival = tracking.arrivalSnapshot();
    expect(smoothArrival.displayMode).toBe("smoothed");
    expect(smoothArrival.sample!.timestamp).toBe(rawArrival.sample!.timestamp);
    expect(phonePosition(tracking.current, tracking.mode)).toEqual(
      next.smoothed,
    );
    tracking.record(fixAt(2000), testCalibration, null);
    expect(smoothArrival.sample).toEqual(next);
    tracking.reset(true);
    expect(tracking.mode).toBe("smoothed");
    expect(tracking.current).toBeNull();
  });

  it("retains rejected callbacks without changing the display or acquisition age", () => {
    const tracking = new PositionTracking();
    const first = tracking.record(fixAt(1000), testCalibration, null);
    for (const fix of [
      fixAt(1000),
      fixAt(500),
      { ...fixAt(2000), receivedAt: 4001 },
      fixAt(2000, -1),
    ]) {
      const recorded = tracking.record(fix, testCalibration, null);
      expect(recorded.smoothed).toBeNull();
      expect(recorded.displayAccepted).toBe(false);
      expect(recorded.timestamp).toBe(fix.timestamp);
      expect(recorded.accuracy).toBe(fix.accuracy);
      expect(tracking.current).toBe(first);
    }
    tracking.reset(); // Visibility pause: next eligible reading initializes a new filter.
    const resumed = tracking.record(
      fixAt(2500, 10, { x: 20, y: 0 }),
      testCalibration,
      null,
    );
    expect(resumed.smoothed).toEqual(resumed.raw);
    tracking.reset(true); // New session or calibration: no old map position survives.
    tracking.record(fixAt(0), null, null);
    expect(tracking.current?.raw).toBeNull();
    expect(tracking.current?.smoothed).toBeNull();
    expect(phonePosition(tracking.current, "smoothed")).toBeNull();
  });

  it("keeps raw-based anchoring independent of smoothing and follow selection", () => {
    const tracking = new PositionTracking();
    tracking.record(fixAt(0), testCalibration, null);
    const fix = fixAt(1000, 10, { x: 8, y: 0 });
    const correction = anchor({ x: 15, y: 0 }, fix, testCalibration, 1100);
    const reading = tracking.record(fix, testCalibration, correction);
    expect(reading.corrected!.x).toBeCloseTo(15);
    expect(reading.smoothed!.x).toBeLessThan(4);
    expect(followPosition(reading, "smoothed")).toEqual(reading.corrected);
    tracking.clearCorrection();
    expect(followPosition(tracking.current, "smoothed")).toEqual(
      reading.smoothed,
    );
    expect(followPosition(tracking.current, "raw")).toEqual(reading.raw);
    expect(reading.corrected!.x).toBeCloseTo(15); // Recorded sample stays immutable.
  });
});

describe("smoothing reports and exports", () => {
  it("measures walking freshness from the retained display when an older callback is rejected", () => {
    const recording = session();
    recording.endedAt = 4000;
    const tracking = new PositionTracking();
    const current = tracking.record(fixAt(1000), testCalibration, null);
    const rejected = tracking.record(
      { ...fixAt(0), receivedAt: 1600 },
      testCalibration,
      null,
    );
    recording.samples.push(current, rejected);
    expect(tracking.current).toBe(current);
    expect(report(recording).freshWalkingPercent).toBe(50);
  });

  it("keeps missing and stale arrivals in denominator and pairs only identical fresh visits", () => {
    const recording = session();
    const tracking = new PositionTracking();
    const first = tracking.record(
      fixAt(1000, 10, { x: 8, y: 0 }),
      testCalibration,
      null,
    );
    recording.samples.push(first);
    recording.events.push(
      {
        at: 1100,
        type: "arrival",
        checkpointId: "A",
        ...tracking.arrivalSnapshot(),
      },
      {
        at: 4001,
        type: "arrival",
        checkpointId: "A",
        ...tracking.arrivalSnapshot(),
      },
      { at: 5000, type: "arrival", checkpointId: "A", sample: null },
      {
        at: 1100,
        type: "arrival",
        checkpointId: "A",
        sample: { ...first, smoothed: null },
      },
    );
    const summary = report(recording);
    expect(summary.smoothedApproxAgreement).toMatchObject({
      denominator: 4,
      under5FreshCount: 0,
    });
    expect(summary.pairedApproxAgreement).toMatchObject({
      pairedCount: 1,
      excludedCount: 3,
    });
    expect(summary.pairedApproxAgreement!.raw.medianMetres).toBeCloseTo(8);
    expect(summary.pairedApproxAgreement!.smoothed.medianMetres).toBeCloseTo(8);
    expect(summary.outcome).toBe(messages.recordings.inconclusive);
    expect(report(session(false)).smoothedApproxAgreement).toBeNull();
    expect(
      renderToStaticMarkup(<SmoothingSummary summary={summary} />),
    ).toContain("excluded: 3");
  });

  it("appends CSV columns, aligns every row and preserves mode/configuration metadata", async () => {
    const recording = session();
    const tracking = new PositionTracking();
    recording.samples.push(tracking.record(fixAt(1000), testCalibration, null));
    recording.events.push({
      at: 1100,
      type: "arrival",
      ...tracking.arrivalSnapshot(),
    });
    const rows = csvRows(csv(recording));
    expect(rows[0].slice(-2)).toEqual(["smoothedX", "smoothedY"]);
    expect(rows.every((row) => row.length === 14)).toBe(true);
    expect(rows[1].slice(-2)).toEqual(["0", "0"]);
    expect(JSON.parse(rows[2][11]).displayMode).toBe("raw");
    expect(JSON.parse(rows[1][11]).displayAccepted).toBe(true);
    const metadata = JSON.parse(rows.at(-1)![11]);
    expect(metadata.notes).toBe(recording.notes);
    expect(metadata.smoothing).toEqual(smoothingConfiguration);
    await save(recording);
    expect((await all()).find((saved) => saved.id === recording.id)).toEqual(
      recording,
    );
    await remove(recording.id);
    const older = session(false);
    older.samples.push(sample(fixAt(1000), testCalibration, null));
    expect(csvRows(csv(older))[1].slice(-2)).toEqual(["", ""]);
    await save(older);
    expect(
      report((await all()).find((saved) => saved.id === older.id)!)
        .pairedApproxAgreement,
    ).toBeNull();
    await remove(older.id);
  });

  it("includes estimates, configuration and reports in JSON downloads", async () => {
    const recording = session();
    recording.samples.push(
      new PositionTracking().record(fixAt(1000), testCalibration, null),
    );
    let downloaded: Blob | undefined;
    vi.stubGlobal("document", { createElement: () => ({ click: vi.fn() }) });
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob) => {
        downloaded = blob as Blob;
        return "blob:test";
      });
    vi.useFakeTimers();
    try {
      download(recording, "json");
      const parsed = JSON.parse(await downloaded!.text());
      expect(parsed.smoothing).toEqual(smoothingConfiguration);
      expect(parsed.samples[0].smoothed).toEqual({ x: 0, y: 0 });
      expect(parsed.report.smoothedApproxAgreement.denominator).toBe(0);
    } finally {
      vi.runAllTimers();
      vi.useRealTimers();
      create.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe("smoothing presentation", () => {
  it("renders only the selected phone position, with accuracy attached exclusively to raw", () => {
    const position = {
      ...sample(fixAt(1000), testCalibration, null),
      smoothed: { x: 12, y: 34 },
    };
    const raw = renderToStaticMarkup(
      <svg>
        <MapMarkers map={map} position={position} displayMode="raw" />
      </svg>,
    );
    const smooth = renderToStaticMarkup(
      <svg>
        <MapMarkers map={map} position={position} displayMode="smoothed" />
      </svg>,
    );
    expect(raw).toContain('r="10"');
    expect(smooth).not.toContain('r="10"');
    expect(smooth).toContain('cx="12" cy="34"');
    expect(smooth).not.toContain('cx="0" cy="0" r="13"');
  });

  it("labels selected mode, stale retained readings and unavailable smoothed estimates", () => {
    const position = sample(fixAt(1000), testCalibration, null);
    const content = renderToStaticMarkup(
      <PositionDisplayControls
        position={position}
        now={3001}
        displayMode="smoothed"
        onChange={() => {}}
      />,
    );
    expect(content).toContain('aria-pressed="true">Smoothed');
    expect(content).toContain(messages.app.smoothedWaiting);
    expect(content).toContain(messages.app.stalePosition);
    expect(content).toContain(messages.app.smoothedUncertainty);
    expect(position.timestamp).toBe(1000);
    const beforeTimerTick = renderToStaticMarkup(
      <PositionDisplayControls
        position={position}
        now={900}
        displayMode="raw"
        onChange={() => {}}
      />,
    );
    expect(beforeTimerTick).not.toContain(messages.app.stalePosition);
  });
});
