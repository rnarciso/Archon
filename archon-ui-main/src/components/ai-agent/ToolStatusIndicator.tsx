import React from 'react';
import { Badge } from '../ui/Badge';

export interface ToolStatusIndicatorProps {
  name: string;
  status: 'available' | 'missing' | 'error' | 'unknown';
  version?: string | null;
  executablePath?: string | null;
  metadata?: Record<string, any>;
  compact?: boolean;
  onRefresh?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const ToolStatusIndicator: React.FC<ToolStatusIndicatorProps> = ({
  name,
  status,
  version,
  executablePath,
  metadata,
  compact = false,
  onRefresh,
  size = 'md',
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'green';
      case 'missing':
        return 'gray';
      case 'error':
        return 'red';
      default:
        return 'orange';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Available';
      case 'missing': return 'Not Installed';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = (status: string) => {
    const sizeClasses = {
      sm: 'w-2 h-2',
      md: 'w-3 h-3',
      lg: 'w-4 h-4',
    };

    const commonClasses = 'rounded-full';

    switch (status) {
      case 'available':
        return (
          <span className={`${commonClasses} ${sizeClasses[size]} bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.5)]`}></span>
        );
      case 'missing':
        return (
          <span className={`${commonClasses} ${sizeClasses[size]} bg-gray-400`}></span>
        );
      case 'error':
        return (
          <span className={`${commonClasses} ${sizeClasses[size]} bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.5)]`}></span>
        );
      default:
        return (
          <span className={`${commonClasses} ${sizeClasses[size]} bg-yellow-500 shadow-[0_0_8px_2px_rgba(234,179,8,0.5)]`}></span>
        );
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {getStatusIcon(status)}
        <Badge
          color={getStatusColor(status) as any}
          variant="solid"
          className="text-xs"
        >
          {getStatusText(status)}
        </Badge>
      </div>
    );
  }

  const containerClasses = {
    sm: 'p-3 rounded-lg border',
    md: 'p-4 rounded-lg border',
    lg: 'p-6 rounded-lg border',
  };

  const borderClasses = {
    available: 'border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/20',
    error: 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20',
    missing: 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50',
    unknown: 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50',
  };

  return (
    <div className={`${containerClasses[size]} ${borderClasses[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-medium text-gray-900 dark:text-white ${
          size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg'
        }`}>
          {name}
        </h3>
        <div className="flex items-center gap-2">
          {getStatusIcon(status)}
          <Badge
            color={getStatusColor(status) as any}
            variant="solid"
            className="text-xs"
          >
            {getStatusText(status)}
          </Badge>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Refresh status"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {version && (
        <p className={`text-sm text-gray-600 dark:text-gray-400 mb-1 ${
          size === 'lg' ? 'text-base' : ''
        }`}>
          Version: {version}
        </p>
      )}
      
      {executablePath && (
        <p className={`text-xs text-gray-500 dark:text-gray-500 truncate ${
          size === 'lg' ? 'text-sm' : ''
        }`}>
          {executablePath}
        </p>
      )}
      
      {status === 'error' && metadata?.error && (
        <p className={`text-xs text-red-600 dark:text-red-400 mt-1 ${
          size === 'lg' ? 'text-sm' : ''
        }`}>
          {metadata.error}
        </p>
      )}
    </div>
  );
};

export default ToolStatusIndicator;