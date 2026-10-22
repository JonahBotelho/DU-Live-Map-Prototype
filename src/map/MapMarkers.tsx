// Renders drawing checkpoints and keeps uncertainty attached to the raw fix only.
import {
  scale,
  type FloorMap,
  type PositionSample,
  type DisplayMode,
} from "../shared/recordingModel";
import { phonePosition } from "../tracking/positionTracking";
export function MapMarkers({
  map,
  position,
  displayMode,
}: {
  map: FloorMap;
  position: PositionSample | null;
  displayMode: DisplayMode;
}) {
  const phone = phonePosition(position, displayMode);
  return (
    <>
      {map.checkpoints.map((checkpoint) => (
        <g key={checkpoint.id}>
          <circle cx={checkpoint.x} cy={checkpoint.y} r="18" fill="#172554" />
          <text
            x={checkpoint.x}
            y={checkpoint.y + 7}
            textAnchor="middle"
            fill="white"
            fontSize="20"
            fontWeight="bold"
          >
            {checkpoint.id}
          </text>
        </g>
      ))}
      {/* The reported radius describes the raw fix; manual anchoring adds unquantified error. */}
      {phone && position && (
        <>
          {displayMode === "raw" && map.calibration && (
            <circle
              cx={phone.x}
              cy={phone.y}
              r={position.accuracy * scale(map.calibration!)}
              fill="#4187e322"
              stroke="#4187e3"
              strokeWidth="2"
            />
          )}
          <circle
            cx={phone.x}
            cy={phone.y}
            r="13"
            fill={displayMode === "raw" ? "#2674cf" : "#0f766e"}
            stroke="white"
            strokeWidth="4"
          />
        </>
      )}
      {position?.corrected && (
        <path
          d={`M${position.corrected.x} ${position.corrected.y - 17}l17 17 -17 17 -17 -17Z`}
          fill="#db782b"
          stroke="white"
          strokeWidth="4"
        />
      )}
    </>
  );
}
