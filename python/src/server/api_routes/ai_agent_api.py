"""
AI Agent API Endpoints for Archon

Provides REST API endpoints for AI agent functionality including tool detection,
command execution, and status management.
"""

import time
from typing import List, Dict, Any
from datetime import datetime
import uuid

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from ..services.ai_detection import (
    AgentDetectionService,
    CommandExecutionService,
    DetectionResult,
    ExecuteRequest,
    ExecuteResponse,
    DetectedTool,
    ToolType
)
from ..config.logfire_config import get_logger, safe_logfire_info, safe_logfire_error

logger = get_logger(__name__)

router = APIRouter(prefix="/api/ai-agent", tags=["ai-agent"])


# Request/Response models
class RefreshDetectionRequest(BaseModel):
    """Request to refresh tool detection"""
    tools_to_detect: List[str] = Field(
        default=["claude_code", "gemini_cli", "qwen_code"],
        description="List of tools to detect"
    )
    force_refresh: bool = Field(default=False, description="Force refresh cache")


class ToolVersionRequest(BaseModel):
    """Request to get tool version"""
    tool_type: str = Field(..., description="Type of tool to get version for")


class ToolVersionResponse(BaseModel):
    """Response with tool version information"""
    tool_type: str
    version: str | None
    status: str
    timestamp: datetime


class HealthResponse(BaseModel):
    """Health check response"""
    service_status: str
    detection_service: str
    execution_service: str
    timestamp: datetime
    uptime_seconds: float


class ServiceStatusResponse(BaseModel):
    """Service status response"""
    detection_summary: Dict[str, Any]
    execution_summary: Dict[str, Any]
    total_available_tools: int
    service_version: str = "1.0.0"


# Manual Agent Configuration Models
class ManualAgentConfig(BaseModel):
    """Configuration for a manually defined AI agent"""
    
    id: str = Field(..., description="Unique identifier")
    name: str = Field(..., description="Human-readable name")
    executable_name: str = Field(..., description="Name of the executable")
    type: str = Field(..., description="Agent type: claude, gemini, qwen, or custom")
    path: str = Field("", description="Full path to the executable")
    version: str = Field("Unknown", description="Agent version")
    description: str = Field("", description="Agent description")
    is_configured: bool = Field(False, description="Whether the agent is properly configured")
    last_tested: datetime | None = Field(None, description="Last testing timestamp")


class CreateManualAgentRequest(BaseModel):
    """Request to create a manual agent configuration"""
    
    name: str = Field(..., description="Human-readable name")
    executable_name: str = Field(..., description="Name of the executable")
    type: str = Field(..., description="Agent type")
    path: str = Field("", description="Full path to the executable")
    version: str = Field("Unknown", description="Agent version")
    description: str = Field("", description="Agent description")


class TestAgentResponse(BaseModel):
    """Response from testing an agent connection"""
    
    success: bool = Field(..., description="Whether the test succeeded")
    message: str = Field(..., description="Test result message")
    version: str | None = Field(None, description="Agent version if test succeeded")


class AgentValidationResponse(BaseModel):
    """Response from validating an agent configuration"""
    
    valid: bool = Field(..., description="Whether the configuration is valid")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    executable_exists: bool = Field(False, description="Whether the executable exists")
    suggested_path: str | None = Field(None, description="Suggested path if applicable")


# Global service instances
_detection_service: AgentDetectionService | None = None
_execution_service: CommandExecutionService | None = None


async def get_detection_service() -> AgentDetectionService:
    """Get or create detection service instance"""
    global _detection_service
    if _detection_service is None:
        _detection_service = AgentDetectionService()
        await _detection_service.clear_cache()  # Initialize with clean cache
    return _detection_service


async def get_execution_service() -> CommandExecutionService:
    """Get or create execution service instance"""
    global _execution_service
    if _execution_service is None:
        detection_service = await get_detection_service()
        _execution_service = CommandExecutionService(detection_service)
        await _execution_service.initialize()
    return _execution_service


@router.get("/health")
async def get_health() -> HealthResponse:
    """
    Health check endpoint for AI Agent services
    
    Returns:
        Health status of detection and execution services
    """
    try:
        start_time = time.time()
        detection_service = await get_detection_service()
        execution_service = await get_execution_service()
        
        # Get service status
        detection_summary = await detection_service.get_detection_summary()
        execution_summary = {
            "initialized": execution_service._is_initialized,
            "running_processes": len(execution_service.executor._running_processes)
        }
        
        uptime = time.time() - start_time
        
        safe_logfire_info(
            "Health check completed",
            detection_status=detection_summary.get("cache_valid", False),
            execution_status=execution_summary.get("initialized", False),
            uptime_seconds=uptime
        )
        
        return HealthResponse(
            service_status="healthy",
            detection_service="healthy",
            execution_service="healthy" if execution_summary.get("initialized", False) else "initializing",
            timestamp=datetime.now(),
            uptime_seconds=uptime
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/tools", response_model=List[DetectedTool])
async def list_tools(
    refresh: bool = False,
    tools: List[str] = None
) -> List[DetectedTool]:
    """
    List detected AI tools and their status
    
    Args:
        refresh: Force refresh cache
        tools: Optional list of specific tools to check
        
    Returns:
        List of detected tools with status information
    """
    try:
        detection_service = await get_detection_service()
        
        # Filter tools if specific tools requested
        tools_to_detect = tools or ["claude_code", "gemini_cli", "qwen_code"]
        tool_types = []
        
        for tool_str in tools_to_detect:
            try:
                # Map string to enum
                if tool_str == "claude_code":
                    tool_types.append(ToolType.CLAUDE_CODE)
                elif tool_str == "gemini_cli":
                    tool_types.append(ToolType.GEMINI_CLI)
                elif tool_str == "qwen_code":
                    tool_types.append(ToolType.QWEN_CODE)
                else:
                    logger.warning(f"Unknown tool type: {tool_str}")
            except ValueError:
                logger.error(f"Invalid tool type: {tool_str}")
        
        if not tool_types:
            tool_types = [ToolType.CLAUDE_CODE, ToolType.GEMINI_CLI, ToolType.QWEN_CODE]
        
        # Create detection request
        from ..services.ai_detection.models import DetectionRequest
        request = DetectionRequest(
            tools_to_detect=tool_types,
            force_refresh=refresh
        )
        
        result = await detection_service.detect_tools(request)
        
        safe_logfire_info(
            "Tools listed successfully",
            total_tools=len(result.tools),
            available_tools=result.total_detected,
            execution_time_ms=result.execution_time_ms
        )
        
        return result.tools
        
    except Exception as e:
        logger.error(f"Failed to list tools: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/detect", response_model=DetectionResult)
async def detect_tools(
    request: RefreshDetectionRequest
) -> DetectionResult:
    """
    Detect AI tools with specific configuration
    
    Args:
        request: Detection request with tools and refresh options
        
    Returns:
        Detailed detection results
    """
    try:
        detection_service = await get_detection_service()
        
        # Map string tools to enum
        tool_types = []
        for tool_str in request.tools_to_detect:
            try:
                if tool_str == "claude_code":
                    tool_types.append(ToolType.CLAUDE_CODE)
                elif tool_str == "gemini_cli":
                    tool_types.append(ToolType.GEMINI_CLI)
                elif tool_str == "qwen_code":
                    tool_types.append(ToolType.QWEN_CODE)
                else:
                    logger.warning(f"Unknown tool type: {tool_str}")
            except ValueError:
                logger.error(f"Invalid tool type: {tool_str}")
        
        if not tool_types:
            tool_types = [ToolType.CLAUDE_CODE, ToolType.GEMINI_CLI, ToolType.QWEN_CODE]
        
        # Create detection request
        from ..services.ai_detection.models import DetectionRequest
        detection_request = DetectionRequest(
            tools_to_detect=tool_types,
            force_refresh=request.force_refresh
        )
        
        result = await detection_service.detect_tools(detection_request)
        
        safe_logfire_info(
            "Tool detection completed",
            tools_count=len(result.tools),
            available_tools=result.total_detected,
            execution_time_ms=result.execution_time_ms,
            errors_count=len(result.errors)
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to detect tools: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/tools/{tool}/version", response_model=ToolVersionResponse)
async def get_tool_version(
    tool: str,
    refresh: bool = False
) -> ToolVersionResponse:
    """
    Get version information for a specific tool
    
    Args:
        tool: Tool type ("claude_code", "gemini_cli", or "qwen_code")
        refresh: Force refresh cache
        
    Returns:
        Version information for the specified tool
    """
    try:
        detection_service = await get_detection_service()
        
        # Map string to enum
        tool_type = None
        if tool == "claude_code":
            tool_type = ToolType.CLAUDE_CODE
        elif tool == "gemini_cli":
            tool_type = ToolType.GEMINI_CLI
        elif tool == "qwen_code":
            tool_type = ToolType.QWEN_CODE
        else:
            raise HTTPException(status_code=400, detail={"error": f"Unknown tool type: {tool}"})
        
        # Get tool status
        tool_info = await detection_service.get_tool_status(tool_type)
        
        if tool_info is None:
            raise HTTPException(status_code=404, detail={"error": f"Tool {tool} not found"})
        
        version = tool_info.version if tool_info.status.value == "available" else None
        status = tool_info.status.value
        
        safe_logfire_info(
            "Tool version retrieved",
            tool=tool,
            version=version,
            status=status
        )
        
        return ToolVersionResponse(
            tool_type=tool,
            version=version,
            status=status,
            timestamp=datetime.now()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get tool version: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/execute", response_model=ExecuteResponse)
async def execute_command(request: ExecuteRequest) -> ExecuteResponse:
    """
    Execute a command using a specific AI tool
    
    Args:
        request: Execution request with tool, command, and options
        
    Returns:
        Command execution results
    """
    try:
        execution_service = await get_execution_service()
        
        safe_logfire_info(
            "Command execution requested",
            tool=request.tool_type.value,
            command=request.command[:100] + "..." if len(request.command) > 100 else request.command,
            timeout_seconds=request.timeout_seconds
        )
        
        result = await execution_service.execute_command(request)
        
        safe_logfire_info(
            "Command execution completed",
            tool=request.tool_type.value,
            success=result.success,
            return_code=result.return_code,
            execution_time_ms=result.execution_time_ms,
            has_output=bool(result.stdout or result.stderr)
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Command execution failed: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/validate-command")
async def validate_command(
    command: str,
    working_directory: str | None = None,
    tool: str | None = None
) -> Dict[str, Any]:
    """
    Validate a command without executing it
    
    Args:
        command: Command to validate
        working_directory: Optional working directory context
        tool: Optional tool context for validation
        
    Returns:
        Validation result with errors and warnings
    """
    try:
        if not command:
            raise HTTPException(status_code=400, detail={"error": "Command is required"})
        
        if tool:
            # Map string to enum for tool-specific validation
            tool_type = None
            if tool == "claude_code":
                tool_type = ToolType.CLAUDE_CODE
            elif tool == "gemini_cli":
                tool_type = ToolType.GEMINI_CLI
            elif tool == "qwen_code":
                tool_type = ToolType.QWEN_CODE
            else:
                raise HTTPException(status_code=400, detail={"error": f"Unknown tool type: {tool}"})
            
            # Get tool info to validate against specific tool
            detection_service = await get_detection_service()
            tool_info = await detection_service.get_tool_status(tool_type)
            
            if tool_info and tool_info.status.value != "available":
                raise HTTPException(status_code=400, detail={"error": f"Tool {tool} is not available"})
        
        # Use command execution service for validation
        execution_service = await get_execution_service()
        validation_result = await execution_service.validate_command(command, working_directory)
        
        safe_logfire_info(
            "Command validation completed",
            command=command[:50] + "..." if len(command) > 50 else command,
            valid=validation_result["valid"],
            errors_count=len(validation_result["errors"]),
            warnings_count=len(validation_result["warnings"])
        )
        
        return validation_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Command validation failed: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/status", response_model=ServiceStatusResponse)
async def get_service_status() -> ServiceStatusResponse:
    """
    Get comprehensive service status
    
    Returns:
        Detailed status of both services
    """
    try:
        detection_service = await get_detection_service()
        execution_service = await get_execution_service()
        
        # Get service summaries
        detection_summary = await detection_service.get_detection_summary()
        execution_history = await execution_service.get_execution_history(10)
        
        # Calculate available tools
        available_tools_count = detection_summary.get("cached_tools", 0)
        if detection_summary.get("cache_valid"):
            available_tools_count = sum(1 for tool in detection_service._cache.values() 
                                      if tool.status.value == "available")
        
        safe_logfire_info(
            "Service status retrieved",
            detection_cache_valid=detection_summary.get("cache_valid", False),
            execution_initialized=execution_service._is_initialized,
            available_tools=available_tools_count
        )
        
        return ServiceStatusResponse(
            detection_summary=detection_summary,
            execution_summary={
                "initialized": execution_service._is_initialized,
                "running_processes": len(execution_service.executor._running_processes),
                "execution_history_count": len(execution_history)
            },
            total_available_tools=available_tools_count
        )
        
    except Exception as e:
        logger.error(f"Failed to get service status: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/clear-cache")
async def clear_cache() -> Dict[str, str]:
    """
    Clear detection and execution caches
    
    Returns:
        Confirmation message
    """
    try:
        detection_service = await get_detection_service()
        execution_service = await get_execution_service()
        
        await detection_service.clear_cache()
        await execution_service.clear_execution_history()
        
        safe_logfire_info("Caches cleared successfully")
        
        return {"message": "Caches cleared successfully"}
        
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/cancel-executions")
async def cancel_executions() -> Dict[str, int]:
    """
    Cancel all running command executions
    
    Returns:
        Cancellation results
    """
    try:
        execution_service = await get_execution_service()
        
        result = await execution_service.cancel_all_executions()
        
        safe_logfire_info(
            "Executions cancelled",
            cancelled=result.get("cancelled", 0),
            remaining=result.get("remaining", 0)
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to cancel executions: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/history")
async def get_execution_history(
    limit: int = 10,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """
    Get command execution history
    
    Args:
        limit: Maximum number of history items to return
        offset: Number of items to skip
        
    Returns:
        Execution history with pagination
    """
    try:
        execution_service = await get_execution_service()
        
        # Get all history and slice for pagination
        all_history = await execution_service.get_execution_history(limit + offset)
        history = all_history[offset:offset + limit]
        
        safe_logfire_info(
            "Execution history retrieved",
            limit=limit,
            offset=offset,
            returned_count=len(history)
        )
        
        return history
        
    except Exception as e:
        logger.error(f"Failed to get execution history: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/supported-tools")
async def get_supported_tools() -> List[str]:
    """
    Get list of supported tool types
    
    Returns:
        List of supported tool names
    """
    try:
        detection_service = await get_detection_service()
        supported_types = await detection_service.get_supported_tools()
        
        tool_names = [tool_type.value for tool_type in supported_types]
        
        safe_logfire_info("Supported tools retrieved", tools=tool_names)
        
        return tool_names
        
    except Exception as e:
        logger.error(f"Failed to get supported tools: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})