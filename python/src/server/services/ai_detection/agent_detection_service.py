"""
AI Agent Detection Service for Archon

Detects and manages AI coding agents and tools installed on the system.
"""

import asyncio
import time
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from ..config.logfire_config import get_logger, safe_logfire_info, safe_logfire_error
from .models import (
    DetectedTool, 
    ToolStatus, 
    ToolType, 
    DetectionResult, 
    DetectionRequest,
    ExecuteRequest,
    ExecuteResponse,
    DetectionResult
)
from .detection_strategies import DetectionStrategyFactory

logger = get_logger(__name__)


class AgentDetectionService:
    """Service for detecting and managing AI coding agents"""
    
    def __init__(self):
        self._cache: Dict[str, DetectedTool] = {}
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl = timedelta(minutes=5)  # Cache detection results for 5 minutes
        self._lock = asyncio.Lock()
    
    async def detect_tools(self, request: DetectionRequest) -> DetectionResult:
        """
        Detect AI tools based on the request
        
        Args:
            request: Detection request with tools to detect and refresh options
            
        Returns:
            DetectionResult with detected tools and metadata
        """
        start_time = time.time()
        errors: List[str] = []
        
        try:
            # Check cache if not forcing refresh
            if not request.force_refresh and self._is_cache_valid():
                logger.info("Using cached detection results")
                return DetectionResult(
                    tools=list(self._cache.values()),
                    total_detected=sum(1 for tool in self._cache.values() if tool.status == ToolStatus.AVAILABLE),
                    detection_timestamp=self._cache_timestamp or datetime.now(),
                    errors=[],
                    execution_time_ms=0
                )
            
            # Clear cache if forcing refresh
            if request.force_refresh:
                self._cache.clear()
                self._cache_timestamp = None
            
            # Detect each requested tool
            tools: List[DetectedTool] = []
            
            async with self._lock:
                for tool_type in request.tools_to_detect:
                    try:
                        strategy = DetectionStrategyFactory.create_strategy(tool_type)
                        tool = await strategy.detect()
                        tools.append(tool)
                        
                        # Update cache
                        self._cache[tool_type.value] = tool
                        
                    except Exception as e:
                        error_msg = f"Error detecting {tool_type.value}: {str(e)}"
                        errors.append(error_msg)
                        logger.error(error_msg)
                        
                        # Add error placeholder to maintain list structure
                        tools.append(DetectedTool(
                            name=f"{tool_type.value.title().replace('_', ' ')}",
                            tool_type=tool_type,
                            status=ToolStatus.ERROR,
                            metadata={"error": str(e)}
                        ))
                
                # Update cache timestamp
                self._cache_timestamp = datetime.now()
            
            # Count available tools
            total_detected = sum(1 for tool in tools if tool.status == ToolStatus.AVAILABLE)
            
            execution_time = (time.time() - start_time) * 1000
            
            result = DetectionResult(
                tools=tools,
                total_detected=total_detected,
                detection_timestamp=datetime.now(),
                errors=errors,
                execution_time_ms=execution_time
            )
            
            safe_logfire_info(
                "AI tool detection completed",
                tools_count=len(tools),
                available_tools=total_detected,
                execution_time_ms=execution_time,
                errors_count=len(errors)
            )
            
            return result
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            error_msg = f"Unexpected error during tool detection: {str(e)}"
            logger.error(error_msg, exc_info=True)
            
            return DetectionResult(
                tools=[],
                total_detected=0,
                detection_timestamp=datetime.now(),
                errors=[error_msg],
                execution_time_ms=execution_time
            )
    
    async def get_tool_status(self, tool_type: ToolType) -> Optional[DetectedTool]:
        """
        Get status of a specific tool
        
        Args:
            tool_type: Type of tool to check
            
        Returns:
            DetectedTool information or None if not found
        """
        try:
            # Check cache first
            if self._is_cache_valid() and tool_type.value in self._cache:
                return self._cache[tool_type.value]
            
            # If cache invalid or missing, detect this specific tool
            strategy = DetectionStrategyFactory.create_strategy(tool_type)
            tool = await strategy.detect()
            
            # Update cache
            async with self._lock:
                self._cache[tool_type.value] = tool
                self._cache_timestamp = datetime.now()
            
            return tool
            
        except Exception as e:
            logger.error(f"Error getting status for {tool_type.value}: {e}")
            return None
    
    async def get_tool_version(self, tool_type: ToolType) -> Optional[str]:
        """
        Get version of a specific tool
        
        Args:
            tool_type: Type of tool to get version for
            
        Returns:
            Version string or None if not available
        """
        try:
            tool = await self.get_tool_status(tool_type)
            if tool and tool.status == ToolStatus.AVAILABLE and tool.version:
                return tool.version
            return None
            
        except Exception as e:
            logger.error(f"Error getting version for {tool_type.value}: {e}")
            return None
    
    async def execute_command(self, request: ExecuteRequest) -> ExecuteResponse:
        """
        Execute a command using the specified AI tool
        
        Args:
            request: Execution request with tool, command, and options
            
        Returns:
            ExecuteResponse with execution results
        """
        start_time = time.time()
        
        try:
            # Check if tool is available
            tool = await self.get_tool_status(request.tool_type)
            if not tool or tool.status != ToolStatus.AVAILABLE:
                return ExecuteResponse(
                    success=False,
                    return_code=-1,
                    execution_time_ms=(time.time() - start_time) * 1000,
                    error_message=f"Tool {request.tool_type.value} is not available"
                )
            
            # Build the command
            command_parts = [tool.metadata.get("command", request.tool_type.value)]
            
            # Simple command validation - ensure it's a reasonable command
            if not request.command.strip():
                return ExecuteResponse(
                    success=False,
                    return_code=-1,
                    execution_time_ms=(time.time() - start_time) * 1000,
                    error_message="Command cannot be empty"
                )
            
            # Add command arguments
            import shlex
            command_parts.extend(shlex.split(request.command))
            
            # Execute command
            logger.info(f"Executing command: {' '.join(command_parts)}")
            
            process = await asyncio.create_subprocess_exec(
                *command_parts,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=request.working_directory,
                timeout=request.timeout_seconds
            )
            
            try:
                stdout, stderr = await process.communicate()
                execution_time = (time.time() - start_time) * 1000
                
                return ExecuteResponse(
                    success=process.returncode == 0,
                    stdout=stdout.decode('utf-8', errors='ignore'),
                    stderr=stderr.decode('utf-8', errors='ignore'),
                    return_code=process.returncode,
                    execution_time_ms=execution_time,
                    error_message=None if process.returncode == 0 else stderr.decode('utf-8', errors='ignore')
                )
                
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                execution_time = (time.time() - start_time) * 1000
                
                return ExecuteResponse(
                    success=False,
                    return_code=-1,
                    execution_time_ms=execution_time,
                    error_message=f"Command timed out after {request.timeout_seconds} seconds"
                )
                
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            error_msg = f"Error executing command: {str(e)}"
            logger.error(error_msg, exc_info=True)
            
            return ExecuteResponse(
                success=False,
                return_code=-1,
                execution_time_ms=execution_time,
                error_message=error_msg
            )
    
    def _is_cache_valid(self) -> bool:
        """Check if cache is still valid based on TTL"""
        if not self._cache_timestamp or not self._cache:
            return False
        
        return datetime.now() - self._cache_timestamp < self._cache_ttl
    
    async def clear_cache(self) -> None:
        """Clear the detection cache"""
        async with self._lock:
            self._cache.clear()
            self._cache_timestamp = None
            logger.info("AI tool detection cache cleared")
    
    async def get_supported_tools(self) -> List[ToolType]:
        """Get list of supported tool types"""
        return DetectionStrategyFactory.get_supported_tools()
    
    async def get_detection_summary(self) -> Dict[str, Any]:
        """Get summary of current detection status"""
        cache_valid = self._is_cache_valid()
        
        return {
            "cache_valid": cache_valid,
            "cache_timestamp": self._cache_timestamp.isoformat() if self._cache_timestamp else None,
            "cached_tools": len(self._cache),
            "supported_tools": len(await self.get_supported_tools()),
            "cache_ttl_minutes": self._cache_ttl.total_seconds() / 60
        }