// Map-first screen composition; tracking and secondary tools have separate modules.
import { messages } from "../locales";
import { usePrototype } from "./usePrototype";
import { FloorPlanMap } from "../map/FloorPlanMap";
import { ControlDock } from "./ControlDock";
import { Tools } from "../tools/Tools";
export function App() {
  const model = usePrototype();
  const {
    map,
    openTools,
    picking,
    busy,
    cancelPicking,
    position,
    pick,
    follow,
    setFollow,
    viewKey,
    setViewKey,
  } = model;
  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>{messages.app.floorTitle}</h1>
          <span className="alignment">
            {map.calibration
              ? messages.app.approximateAlignment
              : messages.app.alignmentUnavailable}
          </span>
        </div>
        <button onClick={openTools} aria-haspopup="dialog">
          {messages.common.tools}
        </button>
      </header>
      <section className="map-stage" aria-label={messages.app.mapLabel}>
        {(picking || busy) && (
          <div className="pick-prompt" role="status">
            <span>
              {busy
                ? messages.app.anchorInstruction
                : picking === "calibration"
                  ? messages.app.calibrationInstruction
                  : messages.app.startingPointInstruction}
            </span>
            <button onClick={cancelPicking}>{messages.common.cancel}</button>
          </div>
        )}
        <FloorPlanMap
          map={map}
          position={position}
          picking={!!picking}
          onPick={pick}
          follow={follow}
          onPan={() => setFollow(false)}
          viewKey={viewKey}
          onFit={() => {
            setFollow(false);
            setViewKey((previousViewKey) => previousViewKey + 1);
          }}
          onRecenter={() => setFollow(true)}
        />
        {position?.corrected && (
          <div className="legend">
            <span>
              <i className="raw-dot" />
              {messages.app.rawLegend}
            </span>
            <span>
              <i className="corrected-diamond" />
              {messages.app.correctedLegend}
            </span>
          </div>
        )}
      </section>
      <ControlDock model={model} />
      <Tools model={model} />
    </main>
  );
}
