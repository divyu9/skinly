import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Keeps a render error from becoming a blank page for a customer.
 *
 * React unmounts the whole tree when a render throws, and the storefront had
 * nothing to catch it — five live orders carry no `items` array, and on the
 * orders list that took the page to white with nothing to read and no way
 * back. A shopper who sees that assumes the shop is broken and leaves.
 *
 * Deliberately plainer than the admin version: no error text, because the
 * message means nothing to a customer and a stack-shaped string reads like
 * something has gone badly wrong. They get a way onward instead, and the
 * details go to the console for us.
 */
export class StorefrontErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Storefront page crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Something went wrong on this page</h1>
          <p className="text-sm text-muted-foreground">
            Sorry about that. Your orders and account are safe — it is only this page that
            failed to load.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
            <a
              className="rounded-lg border px-4 py-2.5 text-sm font-medium"
              href="/"
            >
              Back to home
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Still stuck? Write to{" "}
            <a className="underline" href="mailto:hello@goskinly.com">hello@goskinly.com</a>.
          </p>
        </div>
      </div>
    );
  }
}
