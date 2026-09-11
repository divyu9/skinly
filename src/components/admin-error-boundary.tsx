import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Turns an admin page crash into a page that says what happened.
 *
 * React unmounts the whole tree when a render throws, so one bad field on one
 * record takes the entire screen white with nothing to read and nothing to
 * click — and the screen you need in order to see what is wrong with a record
 * is exactly the screen that will not open. An order with no items did this to
 * the order detail page.
 *
 * The message is for whoever is running the shop, so it says which page broke
 * and offers the two things that actually help: go back, or reload.
 */
export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Admin page crashed:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-4 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">This page could not be shown</h2>
          <p className="text-sm text-muted-foreground">
            Something on this record is not in the shape the page expects, so it stopped
            before it could draw anything. The rest of the admin is unaffected.
          </p>
          <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
            {error.message || String(error)}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => window.history.back()}
            >
              Go back
            </button>
            <button
              className="rounded-lg border px-3 py-2 text-sm font-medium"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
