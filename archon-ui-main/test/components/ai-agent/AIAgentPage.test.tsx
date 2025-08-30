import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import React from 'react'

// Mock the AI Agent Service
vi.mock('../../../services/aiAgentService')
const { 
  aiAgentService, 
  DetectedTool, 
  ExecuteRequest, 
  ExecuteResponse 
} = vi.importActual('../../../services/aiAgentService')

// Mock copyToClipboard
vi.mock('../../../lib/clipboard')
const { copyToClipboard } = vi.importActual('../../../lib/clipboard')

// Mock Toast Context
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn()
  })
}))

// Test data
const mockDetectedTools: DetectedTool[] = [
  {
    name: "Claude Code CLI",
    tool_type: "claude_code",
    status: 'available',
    executable_path: "/usr/local/bin/claude-code",
    version: "1.2.0",
    last_detected: "2025-08-30T10:00:00Z",
    metadata: {}
  },
  {
    name: "Gemini CLI",
    tool_type: "gemini_cli", 
    status: 'missing',
    executable_path: null,
    version: null,
    last_detected: "2025-08-30T10:00:00Z",
    metadata: {}
  },
  {
    name: "Qwen Code",
    tool_type: "qwen_code",
    status: 'available',
    executable_path: "/usr/local/bin/qwen-code",
    version: "0.8.5",
    last_detected: "2025-08-30T10:00:00Z",
    metadata: {}
  }
]

const mockExecutionResult: ExecuteResponse = {
  success: true,
  stdout: "Command executed successfully",
  stderr: null,
  return_code: 0,
  execution_time_ms: 1500,
  error_message: null
}

describe('AIAgentPage Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock API calls
    vi.mocked(aiAgentService.listTools).mockResolvedValue(mockDetectedTools)
    vi.mocked(aiAgentService.detectTools).mockResolvedValue({
      tools: mockDetectedTools,
      total_detected: 2,
      detection_timestamp: new Date().toISOString(),
      errors: [],
      execution_time_ms: 2500
    })
    vi.mocked(aiAgentService.executeCommand).mockResolvedValue(mockExecutionResult)
    vi.mocked(aiAgentService.getToolVersion).mockResolvedValue({
      tool_type: "claude_code",
      version: "1.2.0",
      status: "available",
      timestamp: new Date().toISOString()
    })
  })

  describe('Initial State and Loading', () => {
    test('displays loading state on initial render', () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    test('calls loadTools on component mount', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      expect(aiAgentService.listTools).toHaveBeenCalledWith()
    })
  })

  describe('Tool Detection and Status Display', () => {
    test('dis detected tools with status indicators', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      // Check that tools are displayed
      expect(screen.getByText('Claude Code CLI')).toBeInTheDocument()
      expect(screen.getByText('Gemini CLI')).toBeInTheDocument()
      expect(screen.getByText('Qwen Code')).toBeInTheDocument()
      
      // Check status indicators
      const statusIndicators = screen.getAllByRole('status')
      expect(statusIndicators).toHaveLength(3)
    })

    test('shows version information for available tools', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      expect(screen.getByText('Version: 1.2.0')).toBeInTheDocument()
      expect(screen.getByText('Version: 0.8.5')).toBeInTheDocument()
    })

    test('shows executable paths for available tools', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      expect(screen.getByText('/usr/local/bin/claude-code')).toBeInTheDocument()
      expect(screen.getByText('/usr/local/bin/qwen-code')).toBeInTheDocument()
    })

    test('auto-refresh functionality toggle', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const autoRefreshCheckbox = screen.getByLabelText('Auto-refresh')
      const refreshButton = screen.getByText('Refresh')
      
      // Initially auto-refresh should be off
      expect(autoRefreshCheckbox).not.toBeChecked()
      
      // Toggle on
      fireEvent.click(autoRefreshCheckbox)
      expect(autoRefreshCheckbox).toBeChecked()
      
      // Toggle off
      fireEvent.click(autoRefreshCheckbox)
      expect(autoRefreshCheckbox).not.toBeChecked()
    })

    test('manual refresh button works', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const refreshButton = screen.getByText('Refresh')
      
      fireEvent.click(refreshButton)
      
      expect(aiAgentService.detectTools).toHaveBeenCalledWith({
        tools_to_detect: ['claude_code', 'gemini_cli', 'qwen_code'],
        force_refresh: true
      })
    })
  })

  describe('Command Execution Interface', () => {
    test('tool selection dropdown shows available tools', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const select = screen.getByLabelText('AI Tool')
      expect(select).toBeInTheDocument()
      
      expect(screen.getByText('Claude Code CLI (1.2.0)')).toBeInTheDocument()
      expect(screen.getByText('Qwen Code (0.8.5)')).toBeInTheDocument()
    })

    test('command input validation', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const executeButton = screen.getByText('Execute Command')
      const commandInput = screen.getByPlaceholderText('Enter command to execute...')
      
      // Should be disabled initially with no command
      expect(executeButton).toBeDisabled()
      
      // Enable after entering command
      fireEvent.change(commandInput, { target: { value: 'test command' } })
      expect(executeButton).not.toBeDisabled()
      
      // Should be disabled when no tool is selected
      const select = screen.getByLabelText('AI Tool')
      fireEvent.change(select, { target: { value: '' } })
      expect(executeButton).toBeDisabled()
    })

    test('command execution process', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const select = screen.getByLabelText('AI Tool')
      const commandInput = screen.getByPlaceholderText('Enter command to execute...')
      const executeButton = screen.getByText('Execute Command')
      
      // Set up for execution
      fireEvent.change(select, { target: { value: 'claude_code' } })
      fireEvent.change(commandInput, { target: { value: '--version' } })
      
      // Execute command
      fireEvent.click(executeButton)
      
      // Show loading state
      expect(executeButton).toHaveTextContent('Executing...')
      
      // Wait for execution to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      // Verify API call was made
      expect(aiAgentService.executeCommand).toHaveBeenCalledWith({
        tool_type: 'claude_code',
        command: '--version',
        timeout_seconds: 30
      })
      
      // Check that output is displayed
      expect(screen.getByText('Command executed successfully')).toBeInTheDocument()
      expect(screen.getByText('Return code: 0')).toBeInTheDocument()
      expect(screen.getByText('Execution time: 1500.00ms')).toBeInTheDocument()
    })

    test('copy-to-clipboard functionality', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const select = screen.getByLabelText('AI Tool')
      const commandInput = screen.getByPlaceholderText('Enter command to execute...')
      const executeButton = screen.getByText('Execute Command')
      
      // Execute a command
      fireEvent.change(select, { target: { value: 'claude_code' } })
      fireEvent.change(commandInput, { target: { value: '--version' } })
      fireEvent.click(executeButton)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      // Click copy button
      const copyButton = screen.getByText('Copy Output')
      fireEvent.click(copyButton)
      
      expect(copyToClipboard).toHaveBeenCalledWith('Command executed successfully')
    })

    test('error handling for failed commands', async () => {
      // Mock a failed execution
      vi.mocked(aiAgentService.executeCommand).mockResolvedValue({
        success: false,
        stdout: null,
        stderr: 'Command failed: unknown command',
        return_code: 1,
        execution_time_ms: 500,
        error_message: 'Command failed: unknown command'
      })
      
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const select = screen.getByLabelText('AI Tool')
      const commandInput = screen.getByPlaceholderText('Enter command to execute...')
      const executeButton = screen.getByText('Execute Command')
      
      // Execute failing command
      fireEvent.change(select, { target: { value: 'claude_code' } })
      fireEvent.change(commandInput, { target: { value: 'invalid-command' } })
      fireEvent.click(executeButton)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      expect(screen.getByText('Command failed: unknown command')).toBeInTheDocument()
      expect(screen.getByText('Return code: 1')).toBeInTheDocument()
    })

    test('handles execution timeout', async () => {
      // Mock a timeout
      vi.mocked(aiAgentService.executeCommand).mockRejectedValue(new Error('Command timed out after 30 seconds'))
      
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const select = screen.getByLabelText('AI Tool')
      const commandInput = screen.getByPlaceholderText('Enter command to execute...')
      const executeButton = screen.getByText('Execute Command')
      
      // Execute command that times out
      fireEvent.change(select, { target: { value: 'claude_code' } })
      fireEvent.change(commandInput, { target: { value: 'timeout-test' } })
      fireEvent.click(executeButton)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      // Should show error message
      const errorMessages = screen.getAllByText(/Timeout/i)
      expect(errorMessages.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility and Responsiveness', () => {
    test('has appropriate ARIA labels and roles', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      // Check that all interactive elements have proper labels
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument() // Select dropdown
      expect(screen.getByRole('textbox')).toBeInTheDocument() // Textarea
      expect(screen.getByRole('button', { name: 'Execute Command' })).toBeInTheDocument()
      
      // Progress indicators
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    test('handles missing tools gracefully', async () => {
      // Mock only missing tools
      vi.mocked(aiAgentService.listTools).mockResolvedValue([
        {
          name: "Gemini CLI",
          tool_type: "gemini_cli", 
          status: 'missing',
          executable_path: null,
          version: null,
          last_detected: new Date().toISOString(),
          metadata: {}
        }
      ])
      
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      // Should show "No tools available" message
      expect(screen.getByText('No tools available')).toBeInTheDocument()
    })

    test('displays appropriate error messages', async () => {
      // Mock API error
      vi.mocked(aiAgentService.listTools).mockRejectedValue(new Error('Network error'))
      
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      // Should handle error gracefully
      const errors = screen.getAllByText(/Error/i)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Optimization', () => {
    test('debounces rapid refresh requests', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const refreshButton = screen.getByText('Refresh')
      
      // Click rapidly multiple times
      fireEvent.click(refreshButton)
      fireEvent.click(refreshButton)
      fireEvent.click(refreshButton)
      
      // Should only call the API once (debounced)
      expect(aiAgentService.detectTools).toHaveBeenCalledTimes(1)
    })

    test('caches tool status to avoid unnecessary API calls', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      // Component should cache results and not make redundant calls
      const callCount = vi.mocked(aiAgentService.listTools).mock.calls.length
      expect(callCount).toBe(1)
    })
  })

  describe('Configuration and Settings', () => {
    test('allows custom working directory for command execution', async () => {
      render(require('../../../pages/AIAgentPage').AIAgentPage)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      const select = screen.getByLabelText('AI Tool')
      const commandInput = screen.getByPlaceholderText('Enter command to execute...')
      const executeButton = screen.getByText('Execute Command')
      
      // Execute with working directory context
      const expectedRequest: ExecuteRequest = {
        tool_type: 'claude_code',
        command: 'test',
        timeout_seconds: 30,
        working_directory: '/project/test'
      }
      
      vi.mocked(aiAgentService.executeCommand).mockResolvedValue(mockExecutionResult)
      
      fireEvent.change(select, { target: { value: 'claude_code' } })
      fireEvent.change(commandInput, { target: { value: 'test' } })
      fireEvent.click(executeButton)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      expect(aiAgentService.executeCommand).toHaveBeenCalledWith(expectedRequest)
    })
  })
})