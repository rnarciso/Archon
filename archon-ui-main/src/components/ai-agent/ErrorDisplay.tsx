import React from 'react';
import { Button } from '../ui/Button';

export interface ErrorDisplayProps {
  error: string | Error;
  title?: string;
  severity?: 'error' | 'warning' | 'info';
  onRetry?: () => void;
  onDismiss?: () => void;
  showStack?: boolean;
  errorCode?: string;
  timestamp?: Date;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  title = 'Error',
  severity = 'error',
  onRetry,
  onDismiss,
  showStack = false,
  errorCode,
  timestamp,
  className = '',
}) => {
  const getSeverityStyles = () => {
    switch (severity) {
      case 'warning':
        return 'border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
      case 'info':
        return 'border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400';
      default:
        return 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20 text-red-800 dark:text-red-400';
    }
  };

  const getSeverityIcon = () => {
    const iconClasses = 'w-5 h-5 flex-shrink-0';
    
    switch (severity) {
      case 'warning':
        return (
          <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
        return (
          <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatError = (error: string | Error): string => {
    if (typeof error === 'string') {
      return error;
    }
    return error.message || 'An unknown error occurred';
  };

  const formatStack = (error: Error): string | null => {
    if (!showStack || !(error instanceof Error)) {
      return null;
    }
    return error.stack || null;
  };

  const getErrorObject = () => {
    if (typeof error === 'string') {
      return new Error(error);
    }
    return error;
  };

  const errorObject = getErrorObject();
  const errorMessage = formatError(error);
  const errorStack = formatStack(errorObject);

  return (
    <div className={`p-4 rounded-lg border ${getSeverityStyles()} ${className}`}>
      <div className="flex items-start">
        {getSeverityIcon()}
        <div className="ml-3 flex-1">
          {/* Header */}
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-medium">{title}</h3>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="ml-2 flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                title="Dismiss error"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Error Code */}
          {errorCode && (
            <div className="mt-1">
              <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                Code: {errorCode}
              </span>
            </div>
          )}

          {/* Timestamp */}
          {timestamp && (
            <div className="mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {timestamp.toLocaleString()}
              </span>
            </div>
          )}

          {/* Error Message */}
          <div className="mt-2">
            <p className="text-sm">
              {errorMessage}
            </p>
          </div>

          {/* Error Stack Trace */}
          {errorStack && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer hover:underline">
                View stack trace
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-40">
                <code>{errorStack}</code>
              </pre>
            </details>
          )}
        </div>
      </div>

      {/* Actions */}
      {(onRetry || onDismiss) && (
        <div className="mt-4 flex justify-end space-x-2">
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              accentColor="orange"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Error Boundary for React components
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error; onRetry: () => void }> },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error; onRetry: () => void }> }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
  }

  onRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || ErrorDisplay;
      
      return (
        <FallbackComponent
          error={this.state.error || new Error('An error occurred')}
          title="Component Error"
          onRetry={this.onRetry}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorDisplay;