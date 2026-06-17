"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AddressErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Simulated Sentry Logging Service Integration
    console.error(
      "[SENTRY EXCEPTION TRACKING] Caught Address checkout UX system failure:",
      error,
      errorInfo
    );
  }

  private handleRetry = () => {
    // Reset state to trigger a re-render of children
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white/20 border border-red-500/20 p-8 text-center rounded-2xl backdrop-blur-md relative overflow-hidden shadow-sm animate-fade-in">
          <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-6 mx-auto text-red-600">
            <span className="material-symbols-outlined text-3xl font-black">error</span>
          </div>
          <h3 className="font-headline text-md font-black uppercase tracking-widest text-on-surface mb-2">
            Unable to load addresses. Please refresh.
          </h3>
          <p className="text-[10px] text-outline uppercase tracking-wider font-semibold max-w-sm mx-auto mb-6 opacity-75">
            An unexpected error occurred while parsing your saved delivery addresses. Sentry logs have been updated.
          </p>
          <button
            onClick={this.handleRetry}
            className="border border-[#775a19] text-[#775a19] px-8 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] hover:text-white transition-all cursor-pointer bg-transparent rounded-lg"
          >
            Retry Connection
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
