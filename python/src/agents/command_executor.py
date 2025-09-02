"""
AI Agent Command Execution Service for running commands with detected AI tools.

This service provides secure command execution with proper validation, 
timeout handling, and support for different AI tool patterns.
"""

import asyncio
import logging
import shlex
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel

from .ai_detector import ToolInfo, ToolDetectionService


logger = logging.getLogger(__name__)


@dataclass
class CommandResult:
    """Result of a command execution."""
    
    success: bool
    tool_name: str
    command: str
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    error: Optional[str] = None
    exit_code: Optional[int] = None
    execution_time: float = 0.0
    timeout_occurred: bool = False


@dataclass
class ExecutionRequest:
    """Request to execute a command."""
    
    tool_name: str
    command_args: List[str]
    timeout: float = 30.0
    working_directory: Optional[str] = None
    env_vars: Optional[Dict[str, str]] = None
    allow_network: bool = False


class CommandExecutionService:
    """Service to execute commands with AI tools safely."""
    
    def __init__(self, detection_service: ToolDetectionService):
        self.detection_service = detection_service
        self.supported_tools = ["Gemini CLI", "Qwen Code", "Claude Code CLI"]
        self.command_patterns = {
            "Gemini CLI": ["gemini"],
            "Qwen Code": ["qwen", "code"],
            "Claude Code CLI": ["claude", "cli", "code"]
        }
        self.max_command_length = 1000  # Safety limit
    
    def validate_command(self, request: ExecutionRequest) -> List[str]:
        """Validate and sanitize command arguments."""
        errors = []
        
        # Check if tool is supported
        if request.tool_name not in self.supported_tools:
            errors.append(f"Tool '{request.tool_name}' is not supported")
        
        # Check tool availability
        tool_info = self.detection_service.get_tool_by_name(request.tool_name)
        if not tool_info or not tool_info.is_installed:
            errors.append(f"Tool '{request.tool_name}' is not installed or not available")
        
        # Validate command arguments
        if not request.command_args:
            errors.append("Command arguments cannot be empty")
        
        # Check total command length
        full_command = " ".join(request.command_args)
        if len(full_command) > self.max_command_length:
            errors.append(f"Command too long (max {self.max_command_length} characters)")
        
        # Security checks
        if self._contains_dangerous_commands(request.command_args):
            errors.append("Command contains potentially unsafe operations")
        
        # Check for command injection attempts
        if self._contains_command_injection(request.command_args):
            errors.append("Command contains potential injection attempts")
        
        if errors:
            raise ValueError(f"Command validation failed: {'; '.join(errors)}")
        
        return request.command_args
    
    async def execute_command(self, request: ExecutionRequest) -> CommandResult:
        """Execute a command with proper validation and error handling."""
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Validate the command
            validated_args = self.validate_command(request)
            
            # Build the command
            command_args = self._build_command_args(request.tool_name, validated_args)
            
            logger.info(f"Executing command: {' '.join(command_args)}")
            
            # Execute the command with timeout
            result = await asyncio.wait_for(
                self._run_subprocess(command_args, request),
                timeout=request.timeout
            )
            
            execution_time = asyncio.get_event_loop().time() - start_time
            
            return CommandResult(
                success=result.returncode == 0,
                tool_name=request.tool_name,
                command=" ".join(validated_args),
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.returncode,
                execution_time=execution_time,
                timeout_occurred=False
            )
            
        except asyncio.TimeoutError:
            execution_time = asyncio.get_event_loop().time() - start_time
            logger.warning(f"Command timeout after {execution_time:.2f}s: {request.tool_name}")
            
            return CommandResult(
                success=False,
                tool_name=request.tool_name,
                command=" ".join(request.command_args),
                error=f"Command timed out after {request.timeout}s",
                execution_time=execution_time,
                timeout_occurred=True
            )
            
        except ValueError as e:
            logger.error(f"Command validation error: {e}")
            return CommandResult(
                success=False,
                tool_name=request.tool_name,
                command=" ".join(request.command_args),
                error=str(e),
                execution_time=0.0
            )
            
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            logger.error(f"Command execution error: {e}")
            
            return CommandResult(
                success=False,
                tool_name=request.tool_name,
                command=" ".join(request.command_args),
                error=str(e),
                execution_time=execution_time
            )
    
    async def _run_subprocess(self, command_args: List[str], request: ExecutionRequest):
        """Run subprocess with proper error handling."""
        process = await asyncio.create_subprocess_exec(
            *command_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=request.working_directory,
            env={**request.env_vars} if request.env_vars else None
        )
        
        stdout, stderr = await process.communicate()
        
        return subprocess.CompletedProcess(
            args=command_args,
            returncode=process.returncode,
            stdout=stdout.decode('utf-8', errors='replace').strip(),
            stderr=stderr.decode('utf-8', errors='replace').strip()
        )
    
    def _build_command_args(self, tool_name: str, command_args: List[str]) -> List[str]:
        """Build command arguments based on tool-specific patterns."""
        patterns = self.command_patterns.get(tool_name, [])
        
        # Start with the base executable
        final_args = [command_args[0]]  # This should be the executable itself
        
        # Add remaining arguments
        final_args.extend(command_args[1:])
        
        logger.debug(f"Built command for {tool_name}: {final_args}")
        return final_args
    
    def _contains_dangerous_commands(self, command_args: List[str]) -> bool:
        """Check for potentially dangerous commands."""
        dangerous_keywords = [
            'rm -rf', 'del /s', 'format', 'mkfs', 'dd if=',
            '> /dev/', 'sudo rm', 'systemctl stop', 'service stop',
            'shutdown', 'reboot', 'halt'
        ]
        
        full_command = " ".join(command_args).lower()
        return any(keyword in full_command for keyword in dangerous_keywords)
    
    def _contains_command_injection(self, command_args: List[str]) -> bool:
        """Check for potential command injection attempts."""
        injection_patterns = [
            ';', '&&', '||', '|', '`', '$(', '${', '${',
            '&', '>', '<', '>>', '<<', '2>', '&>', '2>&1'
        ]
        
        for arg in command_args:
            if any(pattern in arg for pattern in injection_patterns):
                return True
        
        return False
    
    def get_help_command(self, tool_name: str) -> List[str]:
        """Get help command for a specific tool."""
        tool_info = self.detection_service.get_tool_by_name(tool_name)
        
        if not tool_info or not tool_info.is_installed:
            raise ValueError(f"Tool '{tool_name}' is not available")
        
        return [tool_info.executable_name, "--help"]
    
    def get_version_command(self, tool_name: str) -> List[str]:
        """Get version command for a specific tool."""
        tool_info = self.detection_service.get_tool_by_name(tool_name)
        
        if not tool_info or not tool_info.is_installed:
            raise ValueError(f"Tool '{tool_name}' is not available")
        
        return [tool_info.executable_name, "--version"]


# Pydantic models for API
class ExecutionResponse(BaseModel):
    """Response model for command execution."""
    
    success: bool
    data: CommandResult
    message: str


class ValidationResponse(BaseModel):
    """Response model for command validation."""
    
    success: bool
    is_valid: bool
    errors: List[str]
    message: str