import React from 'react';

export interface LoadingIndicatorsProps {
  loading?: boolean;
  progress?: number; // 0-100
  message?: string;
  submessage?: string;
  type?: 'spinner' | 'progress' | 'dots' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'purple' | 'pink' | 'orange';
  centered?: boolean;
  overlay?: boolean;
  className?: string;
}

export const LoadingIndicators: React.FC<LoadingIndicatorsProps> = ({
  loading = true,
  progress = 0,
  message = 'Loading...',
  submessage,
  type = 'spinner',
  size = 'md',
  color = 'blue',
  centered = true,
  overlay = false,
  className = '',
}) => {
  if (!loading) return null;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const colorClasses = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    pink: 'text-pink-500',
    orange: 'text-orange-500',
  };

  const spinner = (
    <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${sizeClasses[size]} ${colorClasses[color]}`}>
      <span className="sr-only">Loading...</span>
    </div>
  );

  const progressSpinner = (
    <div className="relative">
      <svg className={`w-12 h-12 ${colorClasses[color]}`} viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <circle
          className="animate-pulse"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeDasharray="31.416"
          strokeDashoffset={31.416 - (progress / 100) * 31.416}
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-medium">{progress}%</span>
      </div>
    </div>
  );

  const dots = (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`w-2 h-2 bg-current rounded-full animate-bounce ${colorClasses[color]}`}
          style={{
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  );

  const pulse = (
    <div className={`flex items-center space-x-2 ${colorClasses[color]}`}>
      <div className={`w-3 h-3 bg-current rounded-full animate-pulse ${sizeClasses[size]}`} />
      <div className={`w-3 h-3 bg-current rounded-full animate-pulse ${sizeClasses[size]}`} style={{ animationDelay: '0.1s' }} />
      <div className={`w-3 h-3 bg-current rounded-full animate-pulse ${sizeClasses[size]}`} style={{ animationDelay: '0.2s' }} />
    </div>
  );

  const renderLoadingIndicator = () => {
    switch (type) {
      case 'progress':
        return progressSpinner;
      case 'dots':
        return dots;
      case 'pulse':
        return pulse;
      default:
        return spinner;
    }
  };

  const content = (
    <div className={`flex flex-col items-center ${centered ? 'justify-center' : ''}`}>
      {renderLoadingIndicator()}
      {message && (
        <p className={`mt-3 font-medium ${sizeClasses[size]} ${colorClasses[color]} text-gray-700 dark:text-gray-300`}>
          {message}
        </p>
      )}
      {submessage && (
        <p className={`mt-1 text-sm ${sizeClasses[size]} text-gray-500 dark:text-gray-400`}>
          {submessage}
        </p>
      )}
    </div>
  );

  const baseClasses = `flex items-center justify-center ${centered ? 'w-full h-full' : ''} ${className}`;

  if (overlay) {
    return (
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center ${baseClasses}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={baseClasses}>
      {content}
    </div>
  );
};

// Progress Bar Component
export interface ProgressBarProps {
  progress: number; // 0-100
  height?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'purple' | 'pink' | 'orange';
  animated?: boolean;
  striped?: boolean;
  showLabel?: boolean;
  rounded?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 'md',
  color = 'blue',
  animated = false,
  striped = false,
  showLabel = false,
  rounded = true,
  className = '',
}) => {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
    orange: 'bg-orange-500',
  };

  const progressClasses = [
    heightClasses[height],
    colorClasses[color],
    animated ? 'animate-pulse' : '',
    striped ? 'bg-stripes' : '',
    rounded ? 'rounded-full' : '',
  ].join(' ');

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${heightClasses[height]} overflow-hidden`}>
        <div
          className={progressClasses}
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 text-center">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
};

export default LoadingIndicators;