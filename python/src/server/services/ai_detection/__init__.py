"""
AI Agent Detection Service for Archon

Provides functionality to detect and manage AI coding agents and tools
installed on the system.
"""

from .agent_detection_service import AgentDetectionService
from .command_execution_service import CommandExecutionService
from .models import DetectedTool, ToolStatus, ToolType, DetectionResult, ExecuteRequest, ExecuteResponse

__all__ = [
    'AgentDetectionService',
    'CommandExecutionService',
    'DetectedTool',
    'ToolStatus',
    'ToolType',
    'DetectionResult',
    'ExecuteRequest',
    'ExecuteResponse'
]