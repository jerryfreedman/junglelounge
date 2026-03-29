'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen jungle-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-deep-jungle/60 border border-tropical-leaf/20 rounded-xl p-8 text-center">
            <div className="text-5xl mb-4">🦩</div>
            <h1 className="font-heading text-2xl text-hot-pink mb-2">Something went wrong</h1>
            <p className="text-flamingo-blush/60 font-body text-sm mb-6">
              An unexpected error occurred. Try refreshing the page.
            </p>
            <p className="text-flamingo-blush/30 font-body text-xs mb-6 break-all">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
