// Native modal shell; the live map remains mounted while secondary controls are open.
import { messages } from "../locales";
import type { Prototype } from "../app/usePrototype";
import { WalkTest } from "./WalkTest";
import { Recordings } from "./Recordings";
import { CalibrationPanel } from "./CalibrationPanel";
export function Tools({ model }: { model: Prototype }) {
  const { toolsDialog, error, storageError } = model;
  return (
    <dialog
      ref={toolsDialog}
      aria-labelledby="tools-title"
      className="tools-dialog"
    >
      <div className="tools-header">
        <h2 id="tools-title">{messages.common.tools}</h2>
        <button autoFocus onClick={() => toolsDialog.current?.close()}>
          {messages.common.close}
        </button>
      </div>
      <div className="tools-content">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {storageError && (
          <p role="alert" className="error">
            {storageError}
          </p>
        )}
        <WalkTest model={model} />
        <Recordings model={model} />
        <CalibrationPanel model={model} />
      </div>
    </dialog>
  );
}
