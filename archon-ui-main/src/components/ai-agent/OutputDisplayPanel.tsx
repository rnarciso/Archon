import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';
import { copyToClipboard } from '../../lib/clipboard';

export interface OutputDisplayPanelProps {
  stdout?: string | null;
  stderr?: string | null;
  returnCode?: number;
  executionTimeMs?: number;
  success?: boolean;
  autoScroll?: boolean;
  maxHeight?: string;
  showMetadata?: boolean;
  onCopy?: (content: string) => void;
  onClear?: () => void;
}

export const OutputDisplayPanel: React.FC<OutputDisplayPanelProps> = ({
  stdout,
  stderr,
  returnCode,
  executionTimeMs,
  success = false,
  autoScroll = true,
  maxHeight = '64',
  showMetadata = true,
  onCopy,
  onClear,
}) => {
  const outputRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
    
    // Apply syntax highlighting when output changes
    if (stdout || stderr) {
      Prism.highlightAll();
    }
  }, [stdout, stderr, autoScroll]);

  const handleCopy = () => {
    const content = (stdout || '') + (stderr ? '\n\nERROR:\n' + stderr : '');
    if (content.trim()) {
      copyToClipboard(content)
        .then(() => {
          setCopied(true);
          if (onCopy) onCopy(content);
          
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((error) => {
          console.error('Failed to copy output:', error);
          // Keep the UI feedback even if copy fails
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
    }
  };

  const handleClear = () => {
    if (onClear) onClear();
  };

  // Language detection for syntax highlighting
  const detectLanguage = useCallback((command: string): string => {
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('python') || lowerCommand.includes('py ') || 
        lowerCommand.includes('pip') || lowerCommand.includes('.py')) {
      return 'python';
    }
    
    if (lowerCommand.includes('node ') || lowerCommand.includes('npm') || 
        lowerCommand.includes('yarn') || lowerCommand.includes('javascript')) {
      return 'javascript';
    }
    
    if (lowerCommand.includes('bash') || lowerCommand.includes('sh ') || 
        lowerCommand.includes('chmod') || lowerCommand.includes('ls ') || 
        lowerCommand.includes('cd ') || lowerCommand.includes('pwd')) {
      return 'bash';
    }
    
    if (lowerCommand.includes('json') || lowerCommand.includes('jq')) {
      return 'json';
    }
    
    if (lowerCommand.includes('go ')) {
      return 'go';
    }
    
    if (lowerCommand.includes('cargo') || lowerCommand.includes('rust')) {
      return 'rust';
    }
    
    return 'text'; // default to plain text
  }, []);

  // Get language for combined output
  const getOutputLanguage = useCallback(() => {
    if (!stdout && !stderr) return 'text';
    
    // Check if we can detect language from command
    const commandParts = (stdout || stderr || '').split('\n')[0];
    if (commandParts.length > 0) {
      return detectLanguage(commandParts);
    }
    
    return 'text';
  }, [stdout, stderr, detectLanguage]);

  const getOutputClassName = (type: 'stdout' | 'stderr') => {
    const baseClasses = 'whitespace-pre-wrap font-mono text-sm';
    
    if (type === 'stdout') {
      return `${baseClasses} text-green-700 dark:text-green-400`;
    } else {
      return `${baseClasses} text-red-700 dark:text-red-400`;
    }
  };

  const hasOutput = stdout || stderr;
  const hasError = stderr || (returnCode !== undefined && returnCode !== 0);

  if (!hasOutput) {
    return (
      <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 h-64 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400 italic text-center">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Execution output will appear here
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Output
        </label>
        <div className="flex gap-2">
          {hasOutput && (
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              accentColor="blue"
              icon={
                copied ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )
              }
            >
              {copied ? 'Copied!' : 'Copy Output'}
            </Button>
          )}
          {onClear && (
            <Button
              onClick={handleClear}
              variant="outline"
              size="sm"
              accentColor="orange"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              }
            >
              Clear
            </Button>
          )}
          {stdout && stderr && (
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="outline"
              size="sm"
              accentColor="purple"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          )}
        </div>
      </div>

      {/* Output Content */}
      <div
        ref={outputRef}
        className={`rounded-lg border ${
          hasError 
            ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20' 
            : success
            ? 'border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
        } overflow-auto ${isExpanded ? 'max-h-96' : `max-h-${maxHeight}`}`}
      >
        <div className="p-3">
          {stdout && (
            <div className={getOutputClassName('stdout')}>
              <pre className="overflow-x-auto">
                <code className={`language-${getOutputLanguage()}`}>
                  {stdout}
                </code>
              </pre>
            </div>
          )}
          
          {stderr && (
            <div className={getOutputClassName('stderr')}>
              <pre className="overflow-x-auto">
                <code className={`language-${getOutputLanguage()}`}>
                  {stderr}
                </code>
              </pre>
            </div>
          )}
          
          {!stdout && !stderr && (
            <div className="text-gray-500 dark:text-gray-400 italic">
              No output
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      {showMetadata && (returnCode !== undefined || executionTimeMs !== undefined) && (
        <div className="flex justify-between text-sm">
          <div className="text-gray-600 dark:text-gray-400">
            {returnCode !== undefined && (
              <span>
                Return code: {returnCode}
                {returnCode !== 0 && <span className="ml-2 text-red-600 dark:text-red-400">(Failed)</span>}
              </span>
            )}
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            {executionTimeMs !== undefined && (
              <span>
                Execution time: {executionTimeMs.toFixed(2)}ms
              </span>
            )}
          </div>
        </div>
      )}

      {/* Status Badge */}
      {success !== undefined && (
        <div className="flex justify-center">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            success 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {success ? (
              <>
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Success
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Failed
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutputDisplayPanel;