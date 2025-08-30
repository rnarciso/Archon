"""
AI Agent Command Execution Service for Archon

Provides secure command execution capabilities for detected AI tools
with advanced input validation, timeout handling, and security controls.
"""

import asyncio
import shlex
import subprocess
import re
import os
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta
from pathlib import Path

from ..config.logfire_config import get_logger, safe_logfire_info, safe_logfire_error
from .models import (
    ToolType,
    ExecuteRequest,
    ExecuteResponse,
    DetectedTool
)
from .agent_detection_service import AgentDetectionService

logger = get_logger(__name__)


class CommandValidator:
    """Validates commands for security and correctness"""
    
    # Dangerous commands and patterns to block
    BLOCKED_COMMANDS = {
        'rm -rf /', 'rm -rf /*', 'sudo rm -rf', 'mkfs', 'dd if=/',
        'wget', 'curl', 'apt-get', 'yum', 'brew', 'npm install',
        'chmod 777', 'chown', 'useradd', 'userdel', 'passwd',
        'docker', 'kubectl', 'git clone', 'scp', 'ssh'
    }
    
    # Dangerous command patterns
    BLOCKED_PATTERNS = [
        r'> /dev/null', r'>&', r'2>&1', r'\.\./', r'~/',
        r'\$\(', r'\${', r'`', r'&&', r'||', r';',
        r'&&.*&&', r'\|\|.*\|\|'
    ]
    
    # Allowed file extensions for safe operations
    ALLOWED_EXTENSIONS = {
        '.md', '.txt', '.py', '.js', '.ts', '.json', '.yaml', '.yml',
        '.html', '.css', '.sql', '.sh', '.ps1', '.bat', '.env'
    }
    
    # Maximum command length
    MAX_COMMAND_LENGTH = 1000
    
    @classmethod
    def validate_command(cls, command: str, working_directory: Optional[str] = None) -> Dict[str, Any]:
        """
        Validate a command for security and correctness
        
        Args:
            command: Command to validate
            working_directory: Optional working directory context
            
        Returns:
            Dict with validation result and any warnings
        """
        errors = []
        warnings = []
        
        # Check basic format
        if not command or not command.strip():
            errors.append("Command cannot be empty")
            return {"valid": False, "errors": errors, "warnings": warnings}
        
        # Check length
        if len(command) > cls.MAX_COMMAND_LENGTH:
            errors.append(f"Command too long (max {cls.MAX_COMMAND_LENGTH} characters)")
        
        # Check for blocked commands
        normalized_command = command.lower().strip()
        for blocked in cls.BLOCKED_COMMANDS:
            if blocked.lower() in normalized_command:
                errors.append(f"Blocked command detected: {blocked}")
        
        # Check for dangerous patterns
        for pattern in cls.BLOCKED_PATTERNS:
            if re.search(pattern, normalized_command):
                warnings.append(f"Potentially dangerous pattern: {pattern}")
        
        # Check file paths if working directory is provided
        if working_directory:
            safe_to_proceed = cls._validate_file_paths(command, working_directory)
            if not safe_to_proceed:
                errors.append("Unsafe file operations detected")
        
        # Check for mixed quotes that could break command parsing
        quote_counts = command.count('"') + command.count("'")
        if quote_counts % 2 != 0:
            warnings.append("Unmatched quotes detected - may cause parsing issues")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    @classmethod
    def _validate_file_paths(cls, command: str, working_directory: str) -> bool:
        """Validate file paths in command against working directory"""
        try:
            work_dir = Path(working_directory).resolve()
            
            # Extract file paths from command (basic pattern matching)
            file_patterns = [
                r'[\'"](.*?)[\'"]',  # Quoted files
                r'(?:\s|^)([^\'"\s]+\.\w+)(?:\s|$)'  # Unquoted file extensions
            ]
            
            for pattern in file_patterns:
                matches = re.findall(pattern, command)
                for file_path in matches:
                    file_path_obj = Path(file_path)
                    
                    # Check if file path tries to escape working directory
                    try:
                        resolved_path = file_path_obj.resolve()
                        if not str(resolved_path).startswith(str(work_dir)):
                            return False
                    except (OSError, RuntimeError):
                        # Path resolution failed - potentially dangerous
                        return False
                    
                    # Check file extension
                    if file_path_obj.suffix.lower() not in cls.ALLOWED_EXTENSIONS:
                        warnings.append(f"Unusual file extension: {file_path_obj.suffix}")
            
            return True
            
        except Exception as e:
            logger.warning(f"Error validating file paths: {e}")
            return False


class CommandExecutor:
    """Handles command execution with safety controls"""
    
    def __init__(self, detection_service: AgentDetectionService):
        self.detection_service = detection_service
        self._running_processes: Dict[str, asyncio.subprocess.Process] = {}
        self._execution_history: List[Dict[str, Any]] = []
        self._max_history_size = 100
    
    async def execute_command(self, request: ExecuteRequest) -> ExecuteResponse:
        """
        Execute a command with proper validation and error handling
        
        Args:
            request: Execution request with tool, command, and options
            
        Returns:
            ExecuteResponse with execution results
        """
        start_time = datetime.now()
        
        try:
            # Step 1: Validate command
            validation_result = CommandValidator.validate_command(
                request.command, 
                request.working_directory
            )
            
            if not validation_result["valid"]:
                return ExecuteResponse(
                    success=False,
                    return_code=-1,
                    execution_time_ms=(datetime.now() - start_time).total_seconds() * 1000,
                    error_message=f"Command validation failed: {'; '.join(validation_result['errors'])}",
                    stderr="\n".join(validation_result["errors"])
                )
            
            if validation_result["warnings"]:
                logger.warning(f"Command validation warnings: {validation_result['warnings']}")
            
            # Step 2: Check tool availability
            tool = await self.detection_service.get_tool_status(request.tool_type)
            if not tool or tool.status != "available":
                return ExecuteResponse(
                    success=False,
                    return_code=-1,
                    execution_time_ms=(datetime.now() - start_time).total_seconds() * 1000,
                    error_message=f"Tool {request.tool_type.value} is not available"
                )
            
            # Step 3: Build and execute command
            command_parts = self._build_command_parts(tool, request.command)
            
            logger.info(f"Executing command: {' '.join(command_parts)}")
            
            # Process creation with security settings
            process = await asyncio.create_subprocess_exec(
                *command_parts,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=request.working_directory,
                timeout=request.timeout_seconds,
                # Security: prevent shell injection
                shell=False,  # Force direct execution instead of shell
                env=self._safe_environment()  # Clean environment
            )
            
            # Store process reference for potential cancellation
            process_id = f"{request.tool_type.value}_{id(process)}"
            self._running_processes[process_id] = process
            
            try:
                # Execute with timeout
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=request.timeout_seconds
                )
                
                execution_time = (datetime.now() - start_time).total_seconds() * 1000
                
                # Store execution history
                await self._store_execution_history({
                    "tool": request.tool_type.value,
                    "command": request.command,
                    "success": process.returncode == 0,
                    "return_code": process.returncode,
                    "execution_time_ms": execution_time,
                    "timestamp": start_time.isoformat()
                })
                
                return ExecuteResponse(
                    success=process.returncode == 0,
                    stdout=stdout.decode('utf-8', errors='ignore'),
                    stderr=stderr.decode('utf-8', errors='ignore'),
                    return_code=process.returncode,
                    execution_time_ms=execution_time,
                    error_message=None if process.returncode == 0 else stderr.decode('utf-8', errors='ignore')
                )
                
            except asyncio.TimeoutError:
                # Cancel running process
                process.kill()
                await process.wait()
                execution_time = (datetime.now() - start_time).total_seconds() * 1000
                
                # Clean up
                if process_id in self._running_processes:
                    del self._running_processes[process_id]
                
                return ExecuteResponse(
                    success=False,
                    return_code=-1,
                    execution_time_ms=execution_time,
                    error_message=f"Command timed out after {request.timeout_seconds} seconds"
                )
                
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            error_msg = f"Command execution failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            
            return ExecuteResponse(
                success=False,
                return_code=-1,
                execution_time_ms=execution_time,
                error_message=error_msg
            )
        
        finally:
            # Clean up tracking
            if process_id in self._running_processes:
                del self._running_processes[process_id]
    
    def _build_command_parts(self, tool: DetectedTool, command: str) -> List[str]:
        """Build command parts with proper quoting"""
        try:
            # Get the base command from tool metadata
            base_command = tool.metadata.get("command", tool.tool_type.value)
            
            # Use shlex to split the command properly
            if command.strip():
                command_parts = [base_command] + shlex.split(command)
            else:
                command_parts = [base_command]
            
            return command_parts
            
        except Exception as e:
            logger.error(f"Error building command parts: {e}")
            # Fallback to simple command
            return [tool.tool_type.value, command]
    
    def _safe_environment(self) -> Dict[str, str]:
        """Create a safe environment for command execution"""
        env = os.environ.copy()
        
        # Remove dangerous environment variables
        dangerous_vars = [
            'PS1', 'PS2', 'PS3', 'PS4',  # Shell prompts
            'HISTFILE', 'HISTCONTROL', 'HISTSIZE',  # History
            'BASH_ENV', 'ENV',  # Shell configuration
            'IFS',  # Internal field separator
            'CDPATH',  # CD path
            'PYTHONPATH', 'PERL5LIB',  # Python/Perl paths
            'LD_PRELOAD', 'LD_LIBRARY_PATH'  # Library paths
        ]
        
        for var in dangerous_vars:
            env.pop(var, None)
        
        # Set safe defaults
        env['HOME'] = '/tmp'
        env['PATH'] = '/usr/local/bin:/usr/bin:/bin'
        env['LANG'] = 'C'
        env['LC_ALL'] = 'C'
        
        return env
    
    async def cancel_running_processes(self) -> Dict[str, int]:
        """Cancel all running processes"""
        cancelled_count = 0
        
        for process_id, process in self._running_processes.items():
            try:
                process.kill()
                await process.wait()
                cancelled_count += 1
                logger.info(f"Cancelled process: {process_id}")
            except Exception as e:
                logger.warning(f"Failed to cancel process {process_id}: {e}")
        
        self._running_processes.clear()
        return {"cancelled": cancelled_count, "remaining": 0}
    
    async def get_execution_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent execution history"""
        return self._execution_history[-limit:]
    
    async def clear_execution_history(self) -> None:
        """Clear execution history"""
        self._execution_history.clear()
        logger.info("Command execution history cleared")


class CommandExecutionService:
    """Main service for AI agent command execution"""
    
    def __init__(self, detection_service: AgentDetectionService):
        self.detection_service = detection_service
        self.executor = CommandExecutor(detection_service)
        self._is_initialized = False
    
    async def initialize(self) -> None:
        """Initialize the command execution service"""
        if self._is_initialized:
            return
        
        logger.info("Initializing Command Execution Service")
        
        # Clear any existing execution history
        await self.executor.clear_execution_history()
        
        self._is_initialized = True
        safe_logfire_info("Command Execution Service initialized")
    
    async def execute_command(self, request: ExecuteRequest) -> ExecuteResponse:
        """
        Execute a command with AI tool
        
        Args:
            request: Execution request with tool, command, and options
            
        Returns:
            ExecuteResponse with execution results
        """
        if not self._is_initialized:
            await self.initialize()
        
        try:
            return await self.executor.execute_command(request)
            
        except Exception as e:
            logger.error(f"Error in command execution service: {e}")
            return ExecuteResponse(
                success=False,
                return_code=-1,
                execution_time_ms=0,
                error_message=f"Service error: {str(e)}"
            )
    
    async def cancel_all_executions(self) -> Dict[str, int]:
        """Cancel all running command executions"""
        return await self.executor.cancel_running_processes()
    
    async def get_execution_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get command execution history"""
        return await self.executor.get_execution_history(limit)
    
    async def validate_command(self, command: str, working_directory: Optional[str] = None) -> Dict[str, Any]:
        """
        Validate a command without executing it
        
        Args:
            command: Command to validate
            working_directory: Optional working directory context
            
        Returns:
            Dict with validation result
        """
        return CommandValidator.validate_command(command, working_directory)