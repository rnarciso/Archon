"""
Pydantic models for AI Agent Detection Service
"""

from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
import subprocess
import re
from datetime import datetime


class ToolStatus(str, Enum):
    """Status of detected AI tools"""
    AVAILABLE = "available"
    MISSING = "missing"
    ERROR = "error"
    UNKNOWN = "unknown"


class ToolType(str, Enum):
    """Types of AI tools supported"""
    CLAUDE_CODE = "claude_code"
    GEMINI_CLI = "gemini_cli"
    QWEN_CODE = "qwen_code"


class DetectedTool(BaseModel):
    """Represents a detected AI tool"""
    
    name: str = Field(..., description="Human-readable name of the tool")
    tool_type: ToolType = Field(..., description="Type of the AI tool")
    status: ToolStatus = Field(..., description="Detection status")
    executable_path: Optional[str] = Field(None, description="Path to the executable")
    version: Optional[str] = Field(None, description="Version information")
    last_detected: datetime = Field(default_factory=datetime.now, description="Last detection timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class DetectionResult(BaseModel):
    """Result of AI tool detection process"""
    
    tools: List[DetectedTool] = Field(default_factory=list, description="List of detected tools")
    total_detected: int = Field(default=0, description="Number of available tools")
    detection_timestamp: datetime = Field(default_factory=datetime.now, description="Detection time")
    errors: List[str] = Field(default_factory=list, description="Any errors during detection")
    execution_time_ms: float = Field(default=0.0, description="Detection execution time in milliseconds")


class DetectionRequest(BaseModel):
    """Request for tool detection"""
    
    tools_to_detect: List[ToolType] = Field(
        default=[ToolType.CLAUDE_CODE, ToolType.GEMINI_CLI, ToolType.QWEN_CODE],
        description="List of tools to detect"
    )
    force_refresh: bool = Field(default=False, description="Force refresh cache")


class ExecuteRequest(BaseModel):
    """Request for tool command execution"""
    
    tool_type: ToolType = Field(..., description="Tool to execute command with")
    command: str = Field(..., description="Command to execute")
    timeout_seconds: int = Field(default=30, description="Execution timeout in seconds")
    working_directory: Optional[str] = Field(None, description="Working directory for execution")


class ExecuteResponse(BaseModel):
    """Response from tool command execution"""
    
    success: bool = Field(..., description="Whether execution was successful")
    stdout: Optional[str] = Field(None, description="Standard output")
    stderr: Optional[str] = Field(None, description="Error output")
    return_code: int = Field(..., description="Process return code")
    execution_time_ms: float = Field(..., description="Execution time in milliseconds")
    error_message: Optional[str] = Field(None, description="Error message if any")