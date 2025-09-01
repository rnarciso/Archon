import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface CommandInputFormProps {
  availableTools: Array<{
    tool_type: string;
    name: string;
    version?: string | null;
  }>;
  onExecute: (toolType: string, command: string) => void;
  executing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  timeout?: number;
  showTimeoutSetting?: boolean;
  workingDirectory?: string;
  validationErrors?: string[];
  onValidationChange?: (errors: string[]) => void;
}

export const CommandInputForm: React.FC<CommandInputFormProps> = ({
  availableTools,
  onExecute,
  executing = false,
  disabled = false,
  placeholder = "Enter command to execute...",
  rows = 4,
  timeout = 30,
  showTimeoutSetting = false,
  workingDirectory,
  validationErrors = [],
  onValidationChange,
}) => {
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [command, setCommand] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [customTimeout, setCustomTimeout] = useState(timeout);

  useEffect(() => {
    // Set default selected tool when available tools change
    if (availableTools.length > 0 && !selectedTool) {
      const availableTool = availableTools.find(tool => tool.tool_type !== '');
      if (availableTool) {
        setSelectedTool(availableTool.tool_type);
      }
    }
  }, [availableTools, selectedTool]);

  const validateCommand = (cmd: string): string[] => {
    const errors: string[] = [];

    if (!cmd.trim()) {
      errors.push('Command cannot be empty');
      return errors;
    }

    // Basic command validation - can be extended based on tool requirements
    if (cmd.length > 5000) {
      errors.push('Command is too long (max 5000 characters)');
    }

    if (cmd.length < 2) {
      errors.push('Command is too short (minimum 2 characters)');
    }

    // Check for potentially dangerous commands (basic filtering)
    const dangerousPatterns = [
      { pattern: /\b(rm|del|erase|delete)\s+-rf\b/i, message: 'Command contains potentially dangerous destructive operations' },
      { pattern: /\breboot\s+-f\b/i, message: 'Force reboot command detected' },
      { pattern: /\bshutdown\b/i, message: 'System shutdown command detected' },
      { pattern: /\bformat\s+/i, message: 'Disk format command detected' },
      { pattern: /\bmkfs\b/i, message: 'Filesystem creation command detected' },
      { pattern: /\b(unlink|rm\s+-f).*\.\.\./i, message: 'Recursive deletion command detected' },
      { pattern: /\bsu\b/i, message: 'Superuser command detected' },
      { pattern: /\bsudo\s+-[a-r]\b/i, message: 'Forceful sudo command detected' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(cmd)) {
        errors.push(message);
      }
    }

    // Check for suspicious network operations
    const suspiciousNetworkPatterns = [
      { pattern: /\bcurl\b.*http.*-o\s+\//i, message: 'File download to root path detected' },
      { pattern: /\bwget\b.*-O\s+\/\//i, message: 'File download detected' },
      { pattern: /\brm\b.*tmp|\/tmp\b/i, message: 'Temporary directory modification detected' },
    ];

    for (const { pattern, message } of suspiciousNetworkPatterns) {
      if (pattern.test(cmd)) {
        errors.push(message);
      }
    }

    // Check for command injection attempts
    const injectionPatterns = [
      { pattern: /\;\s*(rm|del|curl|wget|powershell|bash|sh)\b/i, message: 'Potential command injection attempt' },
      { pattern: /\|\s*(rm|del|curl|wget|powershell|bash|sh)\b/i, message: 'Potential pipe injection attempt' },
      { pattern: /&&\s*(rm|del|curl|wget|powershell|bash|sh)\b/i, message: 'Potential logical injection attempt' },
      { pattern: /\|\|\s*(rm|del|curl|wget|powershell|bash|sh)\b/i, message: 'Potential logical injection attempt' },
    ];

    for (const { pattern, message } of injectionPatterns) {
      if (pattern.test(cmd)) {
        errors.push(message);
      }
    }

    return errors;
  };

  const handleExecute = () => {
    if (!selectedTool) {
      setValidationError('Please select an AI tool');
      if (onValidationChange) {
        onValidationChange(['Please select an AI tool']);
      }
      return;
    }

    const errors = validateCommand(command);
    if (errors.length > 0) {
      setValidationError(errors[0]);
      if (onValidationChange) {
        onValidationChange(errors);
      }
      return;
    }

    // Clear validation errors on successful execution
    setValidationError('');
    if (onValidationChange) {
      onValidationChange([]);
    }

    // Pass timeout to execution handler
    onExecute(selectedTool, command.trim(), customTimeout);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleExecute();
    }
  };

  const handleCommandChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCommand = e.target.value;
    setCommand(newCommand);
    
    // Clear validation error as user types and validate
    const errors = validateCommand(newCommand);
    if (errors.length === 0) {
      setValidationError('');
      if (onValidationChange) {
        onValidationChange([]);
      }
    } else if (!validationError || errors[0] !== validationError) {
      setValidationError(errors[0]);
      if (onValidationChange) {
        onValidationChange(errors);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Tool Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          AI Tool
        </label>
        <select
          value={selectedTool}
          onChange={(e) => setSelectedTool(e.target.value)}
          disabled={disabled || availableTools.length === 0}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {availableTools.length === 0 ? (
            <option value="">No tools available</option>
          ) : (
            availableTools.map((tool) => (
              <option key={tool.tool_type} value={tool.tool_type}>
                {tool.name} {tool.version ? `(${tool.version})` : ''}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Command Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Command
        </label>
        <textarea
          value={command}
          onChange={handleCommandChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled || executing}
          className={`w-full rounded-lg border ${
            validationError 
              ? 'border-red-300 dark:border-red-600 focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
          } bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
        />
        {validationError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {validationError}
          </p>
        )}
        {workingDirectory && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Working directory: {workingDirectory}
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Press Ctrl+Enter or Cmd+Enter to execute
        </p>
      </div>

      {/* Timeout Setting */}
      {showTimeoutSetting && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Timeout (seconds)
          </label>
          <Input
            type="number"
            min="5"
            max="300"
            value={customTimeout}
            onChange={(e) => setCustomTimeout(parseInt(e.target.value) || 30)}
            disabled={disabled || executing}
            accentColor="purple"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Quick: 10s</span>
            <span>Default: 30s</span>
            <span>Long: 60s</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Longer timeouts are useful for complex operations
          </p>
        </div>
      )}

      {/* Execute Button */}
      <Button
        onClick={handleExecute}
        disabled={disabled || executing || !selectedTool || !command.trim() || availableTools.length === 0}
        variant="primary"
        accentColor="purple"
        className="w-full"
        icon={
          executing ? (
            <span className="animate-spin">●</span>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        }
      >
        {executing ? (
          <>
            <span className="animate-spin mr-2">●</span>
            Executing...
          </>
        ) : (
          'Execute Command'
        )}
      </Button>
    </div>
  );
};

export default CommandInputForm;