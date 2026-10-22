// Coordinates the active walkthrough, browser location lifecycle, and UI actions.
import { messages, formatMessage, formatNumber } from "../locales";
import { useEffect, useRef, useState } from "react";
import {
  calibrate,
  anchor,
  sample,
  createSession,
  type FloorMap,
  type TestSession,
  type PositionSample,
  type Point,
  type Anchor,
} from "../shared/recordingModel";
import { BrowserLocation } from "../tracking/browserLocation";
import * as storage from "../recordings/recordingStorage";
import { prototypeFloor, calibrationInput } from "../map/floorPlanCalibration";
export function usePrototype() {
  const [map, setMap] = useState<FloorMap>(prototypeFloor);
  const [session, setSession] = useState<TestSession | null>(null),
    [history, setHistory] = useState<TestSession[]>([]),
    [position, setPosition] = useState<PositionSample | null>(null),
    [status, setStatus] = useState(messages.app.status.ready),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [notes, setNotes] = useState(""),
    [selectedCheckpointId, setSelectedCheckpointId] = useState("A"),
    [observation, setObservation] = useState("not assessed"),
    [picking, setPicking] = useState<"anchor" | "calibration" | null>(null),
    [follow, setFollow] = useState(false),
    [viewKey, setViewKey] = useState(0),
    [calibrationText, setCalibrationText] = useState(
      JSON.stringify(calibrationInput, null, 2),
    ),
    [pickInfo, setPickInfo] = useState(""),
    [busy, setBusy] = useState(false);
  const toolsDialog = useRef<HTMLDialogElement>(null);
  function openTools() {
    setPicking(null);
    toolsDialog.current?.showModal();
  }
  function cancelPicking() {
    anchorRequestToken.current++;
    setPicking(null);
    setBusy(false);
    if (busy) event("anchor-failed", messages.errors.anchorCancelled);
  }
  // Long-lived browser callbacks read refs; React state holds snapshots for rendering.
  const locationProvider = useRef(new BrowserLocation()),
    sessionRef = useRef<TestSession | null>(null),
    lastSample = useRef<PositionSample | null>(null),
    activeAnchor = useRef<Anchor | null>(null),
    // User intent survives visibility pauses, allowing tracking to resume on return.
    trackingRequested = useRef(false),
    anchorRequestToken = useRef(0),
    pendingWrites = useRef(Promise.resolve());
  function persist() {
    const activeSession = sessionRef.current;
    if (!activeSession) return;
    // Freeze each queued write and serialize it so older snapshots cannot overwrite newer ones.
    const snapshot = structuredClone(activeSession);
    setSession(snapshot);
    pendingWrites.current = pendingWrites.current.then(async () => {
      try {
        await storage.save(snapshot);
      } catch (caughtError) {
        setStorageError(
          formatMessage(messages.errors.recordingStorage, {
            detail: String(caughtError),
          }),
        );
      }
    });
  }
  function event(type: string, detail?: string) {
    sessionRef.current?.events.push({ at: Date.now(), type, detail });
    persist();
  }
  function endAnchor() {
    if (activeAnchor.current) {
      activeAnchor.current.endedAt = Date.now();
      activeAnchor.current = null;
    }
    if (lastSample.current) {
      lastSample.current = {
        ...lastSample.current,
        corrected: null,
        anchorId: null,
      };
      setPosition(lastSample.current);
    }
  }
  function watch() {
    locationProvider.current.start(
      (locationFix) => {
        const activeSession = sessionRef.current;
        if (!activeSession || !trackingRequested.current) return;
        const positionSample = sample(
          locationFix,
          activeSession.floor.calibration,
          activeAnchor.current,
        );
        activeSession.samples.push(positionSample);
        lastSample.current = positionSample;
        setPosition(positionSample);
        setStatus(messages.app.status.receiving);
        setError("");
        persist();
      },
      (message) => {
        setError(message);
        event("location-error", message);
      },
    );
  }
  useEffect(() => {
    storage
      .recover()
      .then(setHistory)
      .catch((storageFailure) => setStorageError(String(storageFailure)));
    // Age the displayed reading without fabricating new location samples.
    const ageTimer = setInterval(() => setNow(Date.now()), 500);
    const handleVisibilityChange = () => {
      anchorRequestToken.current++;
      setBusy(false);
      setPicking(null);
      if (!trackingRequested.current) return;
      if (document.hidden) {
        locationProvider.current.stop();
        // A fixed offset may no longer hold after an unobserved gap; require re-anchoring.
        endAnchor();
        event("hidden");
        setStatus(messages.app.status.hidden);
      } else {
        event("visible");
        watch();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(ageTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      locationProvider.current.stop();
    };
  }, []);
  function start() {
    if (!window.isSecureContext) {
      setError(messages.errors.secureContext);
      return;
    }
    const activeSession = createSession(map, notes);
    sessionRef.current = activeSession;
    lastSample.current = null;
    activeAnchor.current = null;
    setPosition(null);
    trackingRequested.current = true;
    activeSession.events.push({ at: Date.now(), type: "start" });
    persist();
    setStatus(messages.app.status.requesting);
    watch();
  }
  async function stop() {
    trackingRequested.current = false;
    anchorRequestToken.current++;
    setBusy(false);
    setPicking(null);
    locationProvider.current.stop();
    endAnchor();
    if (sessionRef.current) {
      sessionRef.current.status = "stopped";
      sessionRef.current.endedAt = Date.now();
      event("stop");
    }
    setStatus(messages.app.status.saved);
    await pendingWrites.current;
    storage
      .all()
      .then((recordings) =>
        setHistory(
          recordings.sort(
            (earlierSession, laterSession) =>
              laterSession.startedAt - earlierSession.startedAt,
          ),
        ),
      )
      .catch((storageFailure) => setStorageError(String(storageFailure)));
  }
  async function pick(point: Point) {
    setPickInfo(
      formatMessage(messages.tools.calibration.selectedCoordinate, {
        x: formatNumber(point.x, 1),
        y: formatNumber(point.y, 1),
      }),
    );
    const mode = picking;
    setPicking(null);
    if (mode === "calibration") {
      toolsDialog.current?.showModal();
      return;
    }
    const activeSession = sessionRef.current;
    if (!activeSession?.floor.calibration || !trackingRequested.current) return;
    await acquireAnchor(point, activeSession);
  }
  async function acquireAnchor(point: Point, activeSession: TestSession) {
    endAnchor();
    event("anchor-start");
    setBusy(true);
    const requestToken = ++anchorRequestToken.current;
    try {
      const locationFix = await locationProvider.current.once();
      // Stop, visibility changes, or another pick can supersede this async request.
      if (requestToken !== anchorRequestToken.current) return;
      const startingAnchor = anchor(
        point,
        locationFix,
        activeSession.floor.calibration!,
        Date.now(),
      );
      activeSession.anchors.push(startingAnchor);
      activeAnchor.current = startingAnchor;
      event("anchor-set");
      setStatus(messages.app.status.anchored);
    } catch (caughtError) {
      if (requestToken === anchorRequestToken.current) {
        setError(String(caughtError));
        event("anchor-failed", String(caughtError));
      }
    } finally {
      if (requestToken === anchorRequestToken.current) setBusy(false);
    }
  }
  function checkpoint() {
    const activeSession = sessionRef.current;
    if (!activeSession) return;
    const arrival =
      activeSession.events
        .filter(
          (sessionEvent) =>
            sessionEvent.type === "arrival" ||
            sessionEvent.type === "departure",
        )
        .at(-1)?.type !== "arrival";
    activeSession.events.push({
      at: Date.now(),
      type: arrival ? "arrival" : "departure",
      checkpointId: selectedCheckpointId,
      // Score what was displayed at arrival, never a better reading received after stopping.
      sample: arrival ? structuredClone(lastSample.current) : undefined,
      anchorId: activeAnchor.current?.id ?? null,
      detail: observation,
    });
    persist();
  }
  async function deleteRecording(id: string) {
    try {
      await storage.remove(id);
      setHistory((items) => items.filter((item) => item.id !== id));
      if (session?.id === id) {
        setSession(null);
        sessionRef.current = null;
      }
    } catch (error) {
      setStorageError(String(error));
    }
  }
  function applyCalibration() {
    try {
      const input = JSON.parse(calibrationText);
      if (!Array.isArray(input?.controls) || typeof input?.source !== "string")
        throw Error(messages.errors.calibrationInput);
      setMap({ ...map, calibration: calibrate(input.controls, input.source) });
      setError("");
    } catch (error) {
      setError(String(error));
    }
  }
  return {
    map,
    session,
    history,
    position,
    status,
    error,
    storageError,
    now,
    notes,
    setNotes,
    selectedCheckpointId,
    setSelectedCheckpointId,
    observation,
    setObservation,
    picking,
    setPicking,
    follow,
    setFollow,
    viewKey,
    setViewKey,
    calibrationText,
    setCalibrationText,
    pickInfo,
    busy,
    toolsDialog,
    openTools,
    cancelPicking,
    start,
    stop,
    pick,
    checkpoint,
    deleteRecording,
    applyCalibration,
  };
}
export type Prototype = ReturnType<typeof usePrototype>;
