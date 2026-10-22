// Checkpoint observations and device notes for a walkthrough.
import { messages, formatMessage, formatNumber } from "../locales";
import type { Prototype } from "../app/usePrototype";
export function WalkTest({ model }: { model: Prototype }) {
  const {
    map,
    session,
    selectedCheckpointId,
    setSelectedCheckpointId,
    observation,
    setObservation,
    busy,
    checkpoint,
    now,
    notes,
    setNotes,
  } = model;
  const isTracking = session?.status === "active";
  const arrival = session?.events
    .filter((event) => event.type === "arrival" || event.type === "departure")
    .at(-1);
  return (
    <details open>
      <summary>{messages.tools.walkTest.title}</summary>
      <div className="tool-section">
        <p>{messages.tools.walkTest.instructions}</p>
        <label>
          {messages.tools.walkTest.checkpoint}
          <select
            value={selectedCheckpointId}
            disabled={arrival?.type === "arrival"}
            onChange={(event) => setSelectedCheckpointId(event.target.value)}
          >
            {map.checkpoints.map((checkpoint) => (
              <option key={checkpoint.id} value={checkpoint.id}>
                {formatMessage(messages.map.checkpointOption, {
                  id: checkpoint.id,
                  label: checkpoint.label,
                })}
              </option>
            ))}
          </select>
        </label>
        <label>
          {messages.tools.walkTest.observation}
          <select
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
          >
            {Object.entries(messages.tools.walkTest.observations).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <button disabled={!isTracking || busy} onClick={checkpoint}>
          {arrival?.type === "arrival"
            ? formatMessage(messages.tools.walkTest.depart, {
                seconds: formatNumber(
                  Math.max(0, Math.floor((now - arrival.at) / 1000)),
                ),
              })
            : messages.tools.walkTest.arrive}
        </button>
        <label>
          {messages.tools.walkTest.notes}
          <textarea
            disabled={isTracking}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={messages.tools.walkTest.notesPlaceholder}
          />
        </label>
      </div>
    </details>
  );
}
