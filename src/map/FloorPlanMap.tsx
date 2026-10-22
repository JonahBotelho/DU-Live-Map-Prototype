// Composes the interactive SVG map, marker layer, and on-map controls.
import { messages } from "../locales";
import { useMapInteraction, type MapInteraction } from "./useMapInteraction";
import { MapMarkers } from "./MapMarkers";
import { followPosition } from "../tracking/positionTracking";
type FloorPlanMapProps = MapInteraction & {
  onFit: () => void;
  onRecenter: () => void;
};
export function FloorPlanMap(props: FloorPlanMapProps) {
  const { map, position, displayMode, onFit, onRecenter, follow } = props;
  const {
    mapSvgRef,
    visibleViewBox,
    screenToMapPoint,
    zoom,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
  } = useMapInteraction(props);
  return (
    <div className="map-wrap">
      <svg
        ref={mapSvgRef}
        aria-label={messages.map.accessibleDescription}
        viewBox={`${visibleViewBox.x} ${visibleViewBox.y} ${visibleViewBox.width} ${visibleViewBox.height}`}
        onWheel={(event) =>
          zoom(event.deltaY > 0 ? 1.15 : 0.85, screenToMapPoint(event))
        }
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
      >
        <image href={map.image} width={map.width} height={map.height} />
        <MapMarkers map={map} position={position} displayMode={displayMode} />
      </svg>
      <div className="map-actions">
        <button onClick={onFit}>{messages.map.fitFloor}</button>
        <button
          disabled={!followPosition(position, displayMode)}
          onClick={onRecenter}
          aria-pressed={follow}
        >
          {messages.map.recenter}
        </button>
      </div>
      <div className="map-tools">
        <button aria-label={messages.map.zoomIn} onClick={() => zoom(0.65)}>
          {messages.map.zoomInSymbol}
        </button>
        <button aria-label={messages.map.zoomOut} onClick={() => zoom(1.5)}>
          {messages.map.zoomOutSymbol}
        </button>
      </div>
    </div>
  );
}
