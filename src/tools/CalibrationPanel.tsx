// Approximate floor alignment editing and coordinate selection.
import { messages, formatMessage, formatNumber, formatList } from "../locales";
import type { Prototype } from "../app/usePrototype";
export function CalibrationPanel({ model }: { model: Prototype }) {
  const {
    session,
    map,
    setPicking,
    toolsDialog,
    pickInfo,
    calibrationText,
    setCalibrationText,
    applyCalibration,
  } = model;
  const isTracking = session?.status === "active";
  return (
    <details>
      <summary>{messages.tools.calibration.title}</summary>
      <div className="tool-section">
        <details className="calibration-help">
          <summary>{messages.tools.calibration.helpTitle}</summary>
          <p>{messages.tools.calibration.help}</p>
          <p>{messages.tools.calibration.uncertainty}</p>
        </details>
        <button
          disabled={isTracking}
          onClick={() => {
            setPicking("calibration");
            toolsDialog.current?.close();
          }}
        >
          {messages.tools.calibration.pickCoordinate}
        </button>
        {pickInfo && <p role="status">{pickInfo}</p>}
        <label>
          {messages.tools.calibration.jsonLabel}
          <textarea
            className="code"
            disabled={isTracking}
            value={calibrationText}
            onChange={(event) => setCalibrationText(event.target.value)}
            spellCheck={false}
          />
        </label>
        <button
          className="primary"
          disabled={isTracking}
          onClick={applyCalibration}
        >
          {messages.tools.calibration.apply}
        </button>
        {map.calibration && (
          <p className="residuals">
            {formatMessage(messages.tools.calibration.residuals, {
              fit: formatList(
                map.calibration.residuals.map((residualMetres) =>
                  formatNumber(residualMetres, 2),
                ),
              ),
              check: formatNumber(map.calibration.checkResidual, 2),
            })}
          </p>
        )}
        <a href="/source.pdf" target="_blank" rel="noreferrer">
          {messages.tools.calibration.sourcePlan}
        </a>
      </div>
    </details>
  );
}
