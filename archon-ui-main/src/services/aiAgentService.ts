/**
 * AI Agent service for interacting with AI coding tools
 */

// Types for manually configured agents
export interface ManualAgentConfig {
  id: string;
  name: string;
  executableName: string;
  type: 'claude' | 'gemini' | 'qwen' | 'custom';
  path: string;
  version: string;
  description: string;
  isConfigured: boolean;
  lastTested: string | null;
}

// Types for AI agent responses
export interface DetectedTool {
  name: string;
  tool_type: string;
  status: 'available' | 'missing' | 'error' | 'unknown';
  executable_path: string | null;
  version: string | null;
  last_detected: string;
  metadata: Record<string, any>;
}

export interface DetectionResult {
  tools: DetectedTool[];
  total_detected: number;
  detection_timestamp: string;
  errors: string[];
  execution_time_ms: number;
}

export interface ExecuteRequest {
  tool_type: string;
  command: string;
  timeout_seconds?: number;
  working_directory?: string;
}

export interface ExecuteResponse {
  success: boolean;
  stdout: string | null;
  stderr: string | null;
  return_code: number;
  execution_time_ms: number;
  error_message: string | null;
}

export interface ToolVersionResponse {
  tool_type: string;
  version: string | null;
  status: string;
  timestamp: string;
}

export interface HealthResponse {
  service_status: string;
  detection_service: string;
  execution_service: string;
  timestamp: string;
  uptime_seconds: number;
}

export interface ServiceStatusResponse {
  detection_summary: Record<string, any>;
  execution_summary: Record<string, any>;
  total_available_tools: number;
  service_version: string;
}

const API_BASE_URL = '/api/ai-agent';

// Generic API request handler with error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

// Retry wrapper for transient errors
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

// Health check
export async function getHealth(): Promise<HealthResponse> {
  return retry(() => apiRequest<HealthResponse>('/health'));
}

// List detected tools
export async function listTools(refresh?: boolean, tools?: string[]): Promise<DetectedTool[]> {
  const params = new URLSearchParams();
  if (refresh !== undefined) params.append('refresh', refresh.toString());
  if (tools && tools.length > 0) {
    params.append('tools', tools.join(','));
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return retry(() => apiRequest<DetectedTool[]>(`/tools${queryString}`));
}

// Detect tools with specific configuration
export async function detectTools(
  tools_to_detect: string[] = ['claude_code', 'gemini_cli', 'qwen_code'],
  force_refresh: boolean = false
): Promise<DetectionResult> {
  return retry(() => apiRequest<DetectionResult>('/detect', {
    method: 'POST',
    body: JSON.stringify({ tools_to_detect, force_refresh }),
  }));
}

// Get version information for a specific tool
export async function getToolVersion(tool: string, refresh?: boolean): Promise<ToolVersionResponse> {
  const params = new URLSearchParams();
  if (refresh !== undefined) params.append('refresh', refresh.toString());
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return retry(() => apiRequest<ToolVersionResponse>(`/tools/${tool}/version${queryString}`));
}

// Execute a command using a specific AI tool
export async function executeCommand(request: ExecuteRequest): Promise<ExecuteResponse> {
  return retry(() => apiRequest<ExecuteResponse>('/execute', {
    method: 'POST',
    body: JSON.stringify(request),
  }));
}

// Validate a command without executing it
export async function validateCommand(
  command: string,
  working_directory?: string,
  tool?: string
): Promise<Record<string, any>> {
  const params = new URLSearchParams();
  params.append('command', command);
  if (working_directory) params.append('working_directory', working_directory);
  if (tool) params.append('tool', tool);
  const queryString = `?${params.toString()}`;
  return retry(() => apiRequest<Record<string, any>>(`/validate-command${queryString}`, {
    method: 'POST',
  }));
}

// Get comprehensive service status
export async function getServiceStatus(): Promise<ServiceStatusResponse> {
  return retry(() => apiRequest<ServiceStatusResponse>('/status'));
}

// Clear detection and execution caches
export async function clearCache(): Promise<{ message: string }> {
  return retry(() => apiRequest<{ message: string }>('/clear-cache', {
    method: 'POST',
  }));
}

// Cancel all running command executions
export async function cancelExecutions(): Promise<Record<string, number>> {
  return retry(() => apiRequest<Record<string, number>>('/cancel-executions', {
    method: 'POST',
  }));
}

// Get command execution history
export async function getExecutionHistory(limit?: number, offset?: number): Promise<Record<string, any>[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append('limit', limit.toString());
  if (offset !== undefined) params.append('offset', offset.toString());
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return retry(() => apiRequest<Record<string, any>[]>(`/history${queryString}`));
}

// Get list of supported tool types
export async function getSupportedTools(): Promise<string[]> {
  return retry(() => apiRequest<string[]>('/supported-tools'));
}

// Manual agent configuration functions

// Add a manually configured agent
export async function addManualAgent(agent: Omit<ManualAgentConfig, 'id' | 'isConfigured' | 'lastTested'>): Promise<ManualAgentConfig> {
  return retry(() => apiRequest<ManualAgentConfig>('/manual-agents', {
    method: 'POST',
    body: JSON.stringify(agent),
  }));
}

// Get all manually configured agents
export async function getManualAgents(): Promise<ManualAgentConfig[]> {
  return retry(() => apiRequest<ManualAgentConfig[]>('/manual-agents'));
}

// Update a manual agent configuration
export async function updateManualAgent(id: string, agent: Partial<ManualAgentConfig>): Promise<ManualAgentConfig> {
  return retry(() => apiRequest<ManualAgentConfig>(`/manual-agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(agent),
  }));
}

// Delete a manual agent configuration
export async function deleteManualAgent(id: string): Promise<{ message: string }> {
  return retry(() => apiRequest<{ message: string }>(`/manual-agents/${id}`, {
    method: 'DELETE',
  }));
}

// Test a manual agent connection
export async function testManualAgent(id: string): Promise<{ success: boolean; message: string; version?: string }> {
  return retry(() => apiRequest<{ success: boolean; message: string; version?: string }>(`/manual-agents/${id}/test`, {
    method: 'POST',
  }));
}

// Validate manual agent configuration before adding
export async function validateManualAgent(agent: Omit<ManualAgentConfig, 'id' | 'isConfigured' | 'lastTested'>): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  executableExists: boolean;
  suggestedPath?: string;
}> {
  return retry(() => apiRequest<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    executableExists: boolean;
    suggestedPath?: string;
  }>('/manual-agents/validate', {
    method: 'POST',
    body: JSON.stringify(agent),
  }));
}