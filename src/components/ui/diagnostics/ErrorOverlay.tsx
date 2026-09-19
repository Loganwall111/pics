import { useSimulationStore } from "@/state/stores/simulationStore";

/**
 * Runtime error surface (§24). Every logged subsystem error appears here
 * with context; fatal errors render prominent. Dismissal is per-entry.
 */
export function ErrorOverlay(): React.JSX.Element | null {
  const errors = useSimulationStore((s) => s.errors);
  const dismiss = useSimulationStore((s) => s.dismissError);
  if (errors.length === 0) return null;

  return (
    <div className="error-overlay">
      {errors.map((e) => (
        <div key={e.id} className={`error-row ${e.fatal ? "fatal" : ""}`}>
          <span className="error-tag">{e.subsystem}</span>
          <span className="error-msg">{e.message}</span>
          <button className="error-dismiss" onClick={() => dismiss(e.id)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
