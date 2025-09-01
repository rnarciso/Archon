import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../contexts/ToastContext';
import { 
  DetectedTool, 
  ExecuteRequest, 
  ExecuteResponse,
  listTools,
  detectTools,
  executeCommand
} from '../services/aiAgentService';
import { copyToClipboard } from '../lib/clipboard';
import { ToolStatusIndicator } from '../components/ai-agent/ToolStatusIndicator';
import { CommandInputForm } from '../components/ai-agent/CommandInputForm';
import { OutputDisplayPanel } from '../components/ai-agent/OutputDisplayPanel';
import { LoadingIndicators, ProgressBar } from '../components/ai-agent/LoadingIndicators';
import { ErrorDisplay } from '../components/ai-agent/ErrorDisplay';
import { ResponsiveLayout, ResponsiveGrid } from '../components/ai-agent/ResponsiveLayout';

/**
 * AI Agent Page Component
 * 
 * This page provides an interface for interacting with AI coding tools
 * that are installed on the server, including Claude Code, Gemini CLI, and Qwen Code.
 * 
 * Features:
 * - Tool detection and status display
 * - Command execution interface
 * - Real-time output display
 * - Copy to clipboard functionality
 * 
 * @component
 */
export const AIAgentPage = () => {
  const [tools, setTools] = useState<DetectedTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecuteResponse | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [customTimeout, setCustomTimeout] = useState(30);
  const { showToast } = useToast();
  
  // Load tools on component mount
  useEffect(() => {
    loadTools();
    
    // Set up auto-refresh if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadTools();
      }, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);
  
  // Load detected tools
  const loadTools = async () => {
    try {
      setLoading(true);
      setError(null);
      const detectedTools = await listTools();
      setTools(detectedTools);
      setRefreshCount(prev => prev + 1);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load AI tools');
      setError(err);
      showToast(`${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Refresh tools manually
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await detectTools();
      setTools(result.tools);
      setRefreshCount(prev => prev + 1);
      showToast(`Detected ${result.total_detected} available tools`, 'success');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to refresh AI tools');
      setError(err);
      showToast(`${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Execute command with enhanced error handling
  const handleExecute = useCallback(async (toolType: string, command: string, timeoutSeconds: number = customTimeout) => {
    try {
      setExecuting(true);
      setExecutionResult(null);
      setError(null);
      setValidationErrors([]); // Clear validation errors
      
      const request: ExecuteRequest = {
        tool_type: toolType,
        command: command.trim(),
        timeout_seconds: timeoutSeconds
      };
      
      showToast(`Running "${command.substring(0, 50)}${command.length > 50 ? '...' : ''}" with ${toolType}`, 'info');
      
      const result = await executeCommand(request);
      setExecutionResult(result);
      
      if (result.success) {
        showToast(`Command completed with return code ${result.return_code} in ${result.execution_time_ms}ms`, 'success');
      } else {
        // Provide more detailed error feedback
        const errorMessage = result.error_message || `Command failed with return code ${result.return_code}`;
        let detailedMessage = errorMessage;
        
        if (result.stderr) {
          detailedMessage += `\n\nError output:\n${result.stderr}`;
        }
        
        showToast(`${detailedMessage}`, 'error');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to execute command');
      setError(err);
      
      // Provide human-friendly error messages
      let errorMessage = 'An unexpected error occurred while executing the command.';
      if (err.message.includes('timeout')) {
        errorMessage = 'Command execution timed out. Please try with a longer timeout or a simpler command.';
      } else if (err.message.includes('tool')) {
        errorMessage = 'AI tool not available. Please check the tool status above.';
      } else if (err.message.includes('network')) {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
      } else if (err.message.includes('permission')) {
        errorMessage = 'Permission denied. Please check if the command has the required permissions.';
      }
      
      showToast(`${errorMessage}`, 'error');
      
      // Show technical details in console
      console.error('Command execution failed:', error);
    } finally {
      setExecuting(false);
    }
  }, [showToast, customTimeout]);
  
  // Get available tools for selection
  const availableTools = tools.filter(tool => tool.status === 'available');
  
  // Handle output copy
  const handleCopyOutput = useCallback((content: string | null) => {
    if (!content) return;
    
    copyToClipboard(content);
    showToast('Output copied to clipboard', 'success');
  }, [showToast]);

  // Clear execution result
  const handleClearOutput = useCallback(() => {
    setExecutionResult(null);
  }, []);

  // Handle error dismiss
  const handleErrorDismiss = useCallback(() => {
    setError(null);
  }, []);

  // Handle tool refresh from indicator
  const handleToolRefresh = useCallback(async (toolName: string) => {
    // This could be enhanced to refresh a specific tool
    handleRefresh();
  }, [handleRefresh]);

  return (
    <ResponsiveLayout
      className="bg-gray-50 dark:bg-gray-900"
      header={
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              AI Agent Interface
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Interact with AI coding tools installed on your server
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              Auto-refresh
            </label>
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="outline"
              size="sm"
              accentColor="blue"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="max-w-6xl mx-auto">
        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <ErrorDisplay
              error={error}
              title="Service Error"
              severity="error"
              onRetry={loadTools}
              onDismiss={handleErrorDismiss}
            />
          </div>
        )}

        {/* Tool Status Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Detected AI Tools {refreshCount > 0 && <span className="text-sm text-gray-500">({refreshCount} refreshes)</span>}
            </h2>
            <div className="text-sm text-gray-500">
              {tools.length} tools detected
            </div>
          </div>
          
          {loading ? (
            <Card className="p-8">
              <LoadingIndicators
                loading={true}
                type="spinner"
                message="Detecting AI tools..."
                submessage="Please wait while we scan for available AI tools"
              />
            </Card>
          ) : (
            <ResponsiveGrid cols={{ default: 1, sm: 2, md: 3 }} gap="md">
              {tools.map((tool) => (
                <Card key={tool.tool_type} className="p-4">
                  <ToolStatusIndicator
                    name={tool.name}
                    status={tool.status}
                    version={tool.version}
                    executablePath={tool.executable_path}
                    metadata={tool.metadata}
                    compact={false}
                    onRefresh={() => handleToolRefresh(tool.name)}
                    size="md"
                  />
                </Card>
              ))}
            </ResponsiveGrid>
          )}

          {tools.length === 0 && !loading && (
            <Card className="p-8 text-center">
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No AI Tools Detected
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No AI coding tools were found on your system. Please ensure that Claude Code, Gemini CLI, or Qwen Code are installed.
              </p>
              <Button onClick={handleRefresh} variant="outline" accentColor="purple">
                Refresh Detection
              </Button>
            </Card>
          )}
        </div>

        {/* Command Execution Section */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Execute Command
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Panel */}
            <div className="flex flex-col">
              <CommandInputForm
                availableTools={availableTools}
                onExecute={handleExecute}
                executing={executing}
                disabled={availableTools.length === 0}
                placeholder="Enter command to execute..."
                rows={6}
                timeout={30}
                workingDirectory="/current/working/directory"
                validationErrors={validationErrors}
                onValidationChange={setValidationErrors}
                showTimeoutSetting={true}
              />
            </div>
            
            {/* Output Panel */}
            <div className="flex flex-col">
              <OutputDisplayPanel
                stdout={executionResult?.stdout || null}
                stderr={executionResult?.stderr || null}
                returnCode={executionResult?.return_code}
                executionTimeMs={executionResult?.execution_time_ms}
                success={executionResult?.success}
                autoScroll={true}
                maxHeight="64"
                showMetadata={true}
                onCopy={handleCopyOutput}
                onClear={handleClearOutput}
              />
            </div>
          </div>
        </Card>

        {/* Auto-refresh status */}
        {autoRefresh && (
          <div className="mt-4 text-sm text-gray-500 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Auto-refresh enabled - Refreshing tools every 30 seconds
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
};