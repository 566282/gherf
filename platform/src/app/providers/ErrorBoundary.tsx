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
        <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[radial-gradient(circle_at_top,rgba(201,130,78,0.08),transparent_25%),linear-gradient(180deg,#07111d_0%,#0b1422_100%)]">
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
                className="inline-flex items-center justify-center rounded-xl bg-mint px-5 py-3 font-medium text-ink transition-colors hover:bg-[#74bea7]"
              >
                Reload page
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-mist transition-colors hover:border-ember/50 hover:text-ember"
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
