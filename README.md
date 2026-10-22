# DU GPS Tracking Prototype

Mobile web-app prototype for the GPS location tracking system system to be implemented in DirectionallyChallenged.
Currently limited to SE12 floor 3 in the BCIT Burnaby Campus for testing purposes.
The app displays a map of the floor, and the users currently location as they walk around.
Built with React, TypeScript and Vite; recordings stay in the browser. No backend or API keys required.

## Run

Requires Node.js 22+.

```sh
npm ci
npm run dev
npm test        # Geometry, location lifecycle, storage and reporting checks
npm run build  # Type-check and generate dist/
```

The dev server defaults to [http://127.0.0.1:8000/](http://127.0.0.1:8000/).

Desktop geolocation works on localhost. For phone testing, open the private HTTPS deployment in Android Chrome, sign in with the owner account, and grant location permission. An HTTP LAN address does not support geolocation.

## File structure

```text
LiveMapTest/
├── AGENTS.md                    Development guidelines
├── README.md
├── index.html                   Page entry
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts               Inserts the document title from locale resources
├── public/                      Original static assets
│   ├── floor.png                Cropped floor-plan image
│   ├── source.pdf               Original BCIT floor plan
│   └── se12-footprint.json      Archived BCIT GIS coordinates
├── src/
│   ├── main.tsx                          Mounts app and imports CSS
│   ├── locales/
│   │   ├── index.ts                      Resources and native Intl formatting
│   │   └── en-CA/                        English JSON by feature: app, common,
│   │                                     errors, map, recordings and tools
│   ├── app/
│   │   ├── App.tsx                       Main screen
│   │   ├── ControlDock.tsx               Tracking status and actions
│   │   ├── usePrototype.ts               Walkthrough state and browser callbacks
│   │   └── app.css
│   ├── map/
│   │   ├── FloorPlanMap.tsx              Map and controls
│   │   ├── MapMarkers.tsx                Checkpoints and location overlays
│   │   ├── useMapInteraction.ts          Pan, zoom and point selection
│   │   ├── floorPlanGeometry.ts          Projection and similarity fitting
│   │   └── floorPlanCalibration.ts       Initial GIS alignment and floor configuration
│   ├── tracking/
│   │   ├── browserLocation.ts            Browser geolocation adapter
│   │   ├── locationSmoothing.ts          Experimental accuracy-adaptive EMA
│   │   └── positionTracking.ts          Eligible display samples and mode selection
│   ├── recordings/
│   │   ├── recordingStorage.ts           IndexedDB persistence and recovery
│   │   ├── recordingReport.ts            Freshness, drift and checkpoint analysis
│   │   ├── smoothingReport.ts            Paired raw/smoothed arrival analysis
│   │   └── recordingExport.ts            JSON/CSV downloads
│   ├── tools/
│   │   ├── Tools.tsx                     Native dialog
│   │   ├── WalkTest.tsx                  Checkpoints and device notes
│   │   ├── Recordings.tsx                Saved sessions and exports
│   │   ├── CalibrationPanel.tsx          Alignment editor
│   │   └── tools.css
│   ├── shared/
│   │   └── recordingModel.ts             Recording types and sample creation
│   └── tests/
│       ├── locationPrototype.test.ts
│       └── localization.test.ts
└── dist/                        Generated build; includes copied public assets
```

Edit assets in `public/`; rebuild to update `dist/`. Installed dependencies (`node_modules/`) and temporary outputs are omitted above.

## Interface text

Edit app-authored text in `src/locales/en-CA/*.json`, including errors, accessibility labels and complete messages with named placeholders. `src/locales/index.ts` bundles the English resources and formats dates, numbers and plural counts with native `Intl`; no translation service or extra dependency is needed. The HTML uses the BCP 47 language tag `en-CA`, and Vite inserts its title from `app.json`.

Keep recorded event/observation codes and export field names stable; map them to resource labels for display. User-entered notes, imported calibration descriptions and browser-provided error details remain data.

## Controls and walkthrough

- **Map:** pan/pinch or use zoom, Fit floor and Recenter. The bottom dock contains Start tracking / Stop & save and Set starting point. Cancel exits point selection.
- **Raw / Smoothed:** choose which phone position to display. Raw (blue) is the default after reload; Smoothed (teal) is experimental. The choice survives new sessions in the current page. Both estimates are calculated and recorded in either mode. The orange manual correction remains based on raw readings and takes priority when following.
- **Tools:** Walk test contains checkpoint controls and device notes; Recordings contains summaries, exports and deletion; Calibration contains alignment settings. Close or Escape returns to the map without pausing tracking or resetting zoom.
- **Calibration picker:** closes Tools while selecting a point, then reopens it with image coordinates.

Before a campus run, verify location permission, recording and export on the phone. Record its model, OS/browser versions, location permission, Wi-Fi and battery-saver settings.

1. Run outdoors-first, indoors-first and reverse-route walks on floor 3. Confirm the eight physical checkpoint locations before testing.
2. Optionally set a starting point while stationary. The anchor requires a reading no older than two seconds; its fixed offset does not remove changing drift.
3. Mark each checkpoint arrival immediately, wait 30 seconds, then depart. Arrival snapshots preserve the position displayed at that moment.

Keep the page visible and phone unlocked. Returning from a hidden page restarts the smoothing filter, retains your display choice and requires a new anchor for correction. Background tracking, offline reload, routing and automatic floor detection are unsupported.

## Experimental smoothing

The dependency-free exponential smoother uses the phone's reported accuracy to choose responsiveness: `timeConstantSeconds = clamp(accuracyMetres / 5, 0.25, 2)`, `weight = 1 - exp(-elapsedSeconds / timeConstantSeconds)`, and `smoothed = previousSmoothed + weight * (raw - previousSmoothed)`. Elapsed time uses acquisition timestamps. This is a heuristic, not a validated confidence estimate; reported accuracy can be misleading indoors.

The first eligible reading initializes the filter directly. New sessions, calibration changes, visibility pauses and acquisition gaps greater than five seconds reset it; startup and reset positions may jump. Toggling the view or setting an anchor does not reset it. No prediction, corridor snapping or distance-based jump rejection is applied.

Only finite, valid coordinates and non-negative accuracy are eligible, with acquisition age between zero and two seconds at receipt. Duplicate, older, stale and invalid callbacks remain recorded but cannot advance the filter or replace the displayed observation. Without calibration, eligible geographic readings remain available but cannot be placed on the map. Retained positions keep their original acquisition timestamp and are labelled stale after two seconds. No raw position is substituted when a smoothed estimate is unavailable.

Smoothing can reduce jitter while introducing walking lag. Noise-free one-second synthetic walking traces at 1.4 m/s show about 0.81 m lag at 5 m reported accuracy and 2.16 m at 10 m or worse. These are implementation checks, not indoor accuracy claims. Smoothing does not reliably correct sustained bias or correlated indoor errors. The raw accuracy circle is shown only in Raw mode; the numerical accuracy statistic always describes the phone reading, and smoothed uncertainty remains unvalidated.

## Calibration

The PDF is not to scale and has no geographic coordinates. Initial alignment fits three building corners from BCIT's public GIS footprint (SE12, OBJECTID 33) and checks a fourth. Provenance and controls are in `src/map/floorPlanCalibration.ts`; original coordinates are in `public/se12-footprint.json`.

The held-out discrepancy is approximately **1.06 m**. This checks alignment consistency, not GPS accuracy: the ground footprint may differ from floor 3. The raster is 2800 × 887 pixels, rendered from the PDF at 4000 pixels wide, cropped from (200, 660) to (3800, 1800), then resized.

To replace alignment, paste JSON in Tools → Calibration with `source` and four `controls`. Each control needs `label`, `latitude`, `longitude`, `x` and `y`; use WGS84 degrees and cropped-image pixels. The first three points must be non-collinear; the fourth is held out. Include the source URL, date and landmark descriptions. Never fit alignment to test-walk readings.

Calibration changes last until reload and are embedded in each session. Save the JSON for reuse. Missing calibration disables map placement but still allows recording.

## Recordings and results

Sessions persist in this browser's IndexedDB until deleted. Export before clearing browser data; downloads contain location data. JSON contains readings, calibration, checkpoints, anchors, timestamps, events, notes and analysis. CSV contains sample rows plus JSON detail cells. Storage failures are shown explicitly; the current in-memory session remains exportable. Reload marks unfinished sessions interrupted at their last recorded activity. Avoid concurrent recording tabs.

All original readings are retained. New recordings add optional `smoothed` map coordinates to samples and optional `smoothing` algorithm/configuration metadata to sessions. Rejected callbacks have no smoothed position. Samples also record `displayAccepted`, indicating whether the callback replaced the displayed observation; CSV preserves it in the existing sample `detail` cell. Walking freshness follows accepted display observations, so a rejected older callback cannot replace a newer reading in the analysis. Older samples without this field retain their original interpretation. Initial display mode and changes are recorded as `display-mode` events; arrival snapshots include `displayMode` and both estimates available at that moment. CSV appends `smoothedX` and `smoothedY` after the existing columns and includes configuration in its metadata detail cell. Older recordings remain readable, with smoothing comparisons unavailable; they are never retroactively smoothed.

Analysis weights checkpoint visits equally and measures walking freshness in one-second bins. Missing/stale observations and unexpected walking gaps remain in the denominators; planned stops and anchor initialization are excluded from walking coverage. Smoothed approximate agreement uses all arrivals as the under-5-m success denominator. Its standalone median/p90 describe measurable visits (including stale ones, matching existing raw summaries); use the paired comparison for a fair accuracy comparison. Paired raw/smoothed median and p90 errors use exactly the same fresh arrivals with both estimates and report paired/excluded counts. Recordings shows these paired results; full analysis remains in exports.

At the next building visit, compare both estimates from the same walks at physically verified centre and edge checkpoints. Include immediate arrivals, 30-second stationary stops and turns; check lag as well as jitter and error. Keep smoothing experimental until independent references show a benefit. A visually steadier marker alone does not demonstrate improved accuracy.

Spatial results remain **inconclusive without independent references**. The later validation target is at least 90% of arrivals with error plus reference uncertainty below 5 m, and at least 95% walking coverage with readings no older than two seconds. Reference uncertainty must be documented at ≤1 m. Interrupted sessions cannot establish a pass; repeat on a second Android model before integration.

Desktop tests do not validate indoor reception, physical checkpoint correspondence or Android behavior. No campus measurements are bundled.
