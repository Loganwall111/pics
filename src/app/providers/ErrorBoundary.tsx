import { Component, type ErrorInfo, type ReactNode } from "react";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { createLogger } from "@/lib/utilities/logger";

const log = createLogger("error-boundary");

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level React error boundary (§24).
 * A crashed render tree must never white-screen the tab silently: the error
 * is logged with subsystem context and surfaced through the error overlay.
 * Recovery requires a page reload (documented limitation).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error(`render tree failure: ${error.message}`, info.componentStack, true);
    useSimulationStore.getState().pushError("render", `Scene failure: ${error.message}`, true);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="fatal-overlay">
          <div className="fatal-card">
            <h2>SIMULATION FAULT</h2>
            <p>{this.state.error.message}</p>
            <pre>{this.state.error.stack?.slice(0, 800) ?? ""}</pre>
            <button onClick={() => window.location.reload()}>Reload simulator</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
