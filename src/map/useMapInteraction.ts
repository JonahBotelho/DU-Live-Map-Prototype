// Owns the SVG viewBox and pointer gestures independently of floor rendering.
import { useRef, useState, type PointerEvent } from "react";
import type {
  FloorMap,
  Point,
  PositionSample,
  DisplayMode,
} from "../shared/recordingModel";
import { followPosition } from "../tracking/positionTracking";
export function useMapInteraction({
  map,
  position,
  displayMode,
  picking,
  onPick,
  viewKey,
  follow,
  onPan,
}: MapInteraction) {
  const mapSvgRef = useRef<SVGSVGElement>(null),
    pointers = useRef(new Map<number, Point>());
  const [view, setView] = useState({
    x: 0,
    y: 0,
    width: map.width,
    height: map.height,
  });
  const previousKey = useRef(viewKey);
  const isDragging = useRef(false);
  const gestureStart = useRef<Point | null>(null);
  let visibleViewBox = view;
  if (previousKey.current !== viewKey) {
    previousKey.current = viewKey;
    visibleViewBox = { x: 0, y: 0, width: map.width, height: map.height };
    setView(visibleViewBox);
  }
  const target = followPosition(position, displayMode);
  if (follow && target)
    visibleViewBox = {
      ...visibleViewBox,
      x: target.x - visibleViewBox.width / 2,
      y: target.y - visibleViewBox.height / 2,
    };
  function screenToMapPoint(event: { clientX: number; clientY: number }) {
    // Undo SVG scaling, letterboxing, and the current viewBox before picking or panning.
    const screenToMapTransform = mapSvgRef.current!.getScreenCTM()!.inverse();
    const mapPoint = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      screenToMapTransform,
    );
    return { x: mapPoint.x, y: mapPoint.y };
  }
  function zoom(
    zoomFactor: number,
    center: Point = {
      x: visibleViewBox.x + visibleViewBox.width / 2,
      y: visibleViewBox.y + visibleViewBox.height / 2,
    },
  ) {
    onPan();
    const width = Math.min(
        map.width * 8,
        Math.max(120, visibleViewBox.width * zoomFactor),
      ),
      height = (width * map.height) / map.width;
    // Keep the chosen zoom center at the same screen position as the view changes size.
    setView({
      x:
        center.x -
        ((center.x - visibleViewBox.x) * width) / visibleViewBox.width,
      y:
        center.y -
        ((center.y - visibleViewBox.y) * height) / visibleViewBox.height,
      width,
      height,
    });
  }
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    gestureStart.current = { x: event.clientX, y: event.clientY };
    isDragging.current = false;
  }
  function moveGesture(
    previousPointer: Point,
    nextPointer: Point,
    otherPointers: [number, Point][],
  ) {
    if (otherPointers.length) {
      const otherPointer = otherPointers[0][1],
        previousDistance = Math.hypot(
          previousPointer.x - otherPointer.x,
          previousPointer.y - otherPointer.y,
        ),
        nextDistance = Math.hypot(
          nextPointer.x - otherPointer.x,
          nextPointer.y - otherPointer.y,
        );
      if (previousDistance > 0 && nextDistance > 0)
        zoom(previousDistance / nextDistance);
    } else if (isDragging.current) {
      const mapPoint = screenToMapPoint({
          clientX: nextPointer.x,
          clientY: nextPointer.y,
        }),
        previousMapPoint = screenToMapPoint({
          clientX: previousPointer.x,
          clientY: previousPointer.y,
        });
      onPan();
      setView({
        ...visibleViewBox,
        x: visibleViewBox.x + previousMapPoint.x - mapPoint.x,
        y: visibleViewBox.y + previousMapPoint.y - mapPoint.y,
      });
    }
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const previousPointer = pointers.current.get(event.pointerId);
    if (!previousPointer) return;
    const nextPointer = { x: event.clientX, y: event.clientY };
    // Small finger movements should still count as a tap when selecting an anchor.
    if (
      gestureStart.current &&
      Math.hypot(
        nextPointer.x - gestureStart.current.x,
        nextPointer.y - gestureStart.current.y,
      ) > 5
    )
      isDragging.current = true;
    const otherPointers = [...pointers.current.entries()].filter(
      ([id]) => id !== event.pointerId,
    );
    moveGesture(previousPointer, nextPointer, otherPointers);
    pointers.current.set(event.pointerId, nextPointer);
  }
  function pointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!isDragging.current && picking && pointers.current.size === 1) {
      const mapPoint = screenToMapPoint(event);
      if (
        mapPoint.x >= 0 &&
        mapPoint.y >= 0 &&
        mapPoint.x <= map.width &&
        mapPoint.y <= map.height
      )
        onPick(mapPoint);
    }
    pointers.current.delete(event.pointerId);
  }
  function pointerCancel(event: PointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
  }
  return {
    mapSvgRef,
    visibleViewBox,
    screenToMapPoint,
    zoom,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
  };
}
export type MapInteraction = {
  map: FloorMap;
  position: PositionSample | null;
  displayMode: DisplayMode;
  picking: boolean;
  onPick: (mapPoint: Point) => void;
  viewKey: number;
  follow: boolean;
  onPan: () => void;
};
