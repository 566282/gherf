import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Card } from '@/components/ui/Card';
import { logError } from '@/lib/logger';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError(error, 'Unhandled React render error', {
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  override render(): JSX.Element {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10">
          <Card className="max-w-xl w-full text-center space-y-6">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.25em] text-mist">Application error</p>
              <h1 className="text-3xl font-bold text-ember">Something went wrong</h1>
              <p className="text-mist">
                The app hit an unexpected error. Reload the page or return to the home screen.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-mint text-ink font-medium hover:bg-green-600 transition-colors"
              >
                Reload page
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-mist/30 text-mist hover:text-ember hover:border-ember transition-colors"
              >
                Go home
              </a>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
