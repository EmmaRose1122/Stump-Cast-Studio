import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui';

interface Props {
  children: ReactNode;
  /** Changing this clears the failure, so navigating away from a broken page recovers. */
  pageKey: string;
}

interface State {
  error: Error | null;
}

/**
 * Keeps one crashing page from blanking the whole control room: without it any render throw
 * during a live broadcast left the operator with an empty window and no ON AIR indicator.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Admin page crashed:', error, info.componentStack);
  }

  override componentDidUpdate(prev: Props): void {
    if (prev.pageKey !== this.props.pageKey && this.state.error) this.setState({ error: null });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="rounded-xl border border-error/40 bg-error/10 p-5">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-error">
          This page stopped working
        </h2>
        <p className="mt-1 text-sm text-muted">
          The rest of the studio is still live. Details: {error.message}
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
