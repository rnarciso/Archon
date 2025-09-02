"""
AI Agent Detection Service for detecting installed AI tools on the server.

This service detects and provides information about available AI tools including:
- Gemini CLI
- Qwen Code  
- Claude Code CLI
"""

import logging
import shutil
import subprocess
from dataclasses import dataclass
from typing import Dict, List, Optional

from pydantic import BaseModel


logger = logging.getLogger(__name__)


@dataclass
class ToolInfo:
    """Information about a detected AI tool."""
    
    name: str
    executable_name: str
    is_installed: bool
    version: Optional[str] = None
    path: Optional[str] = None
    error: Optional[str] = None


@dataclass
class DetectionResult:
    """Result of the AI tool detection process."""
    
    total_tools: int
    installed_tools: int
    tools: List[ToolInfo]
    scan_summary: str


class ToolDetectionService:
    """Service to detect and manage AI tool installations."""
    
    def __init__(self):
        self.tools_to_detect = [
            ToolInfo(name="Gemini CLI", executable_name="gemini", is_installed=False),
            ToolInfo(name="Qwen Code", executable_name="qwen", is_installed=False),
            ToolInfo(name="Claude Code CLI", executable_name="claude", is_installed=False),
        ]
    
    def detect_all_tools(self) -> DetectionResult:
        """Detect all supported AI tools and return results."""
        logger.info("Starting AI tool detection scan")
        
        detected_tools = []
        installed_count = 0
        
        for tool in self.tools_to_detect:
            try:
                detected_tool = self._detect_tool(tool)
                detected_tools.append(detected_tool)
                
                if detected_tool.is_installed:
                    installed_count += 1
                    logger.info(f"✅ {tool.name} detected: {detected_tool.version}")
                else:
                    logger.warning(f"❌ {tool.name} not found")
                    
            except Exception as e:
                logger.error(f"⚠️ Error detecting {tool.name}: {e}")
                detected_tools.append(ToolInfo(
                    name=tool.name,
                    executable_name=tool.executable_name,
                    is_installed=False,
                    error=str(e)
                ))
        
        summary = f"Detected {installed_count}/{len(self.tools_to_detect)} AI tools"
        
        return DetectionResult(
            total_tools=len(self.tools_to_detect),
            installed_tools=installed_count,
            tools=detected_tools,
            scan_summary=summary
        )
    
    def _detect_tool(self, tool: ToolInfo) -> ToolInfo:
        """Detect a specific AI tool and return its information."""
        # Check if the executable exists
        executable_path = shutil.which(tool.executable_name)
        
        if not executable_path:
            return ToolInfo(
                name=tool.name,
                executable_name=tool.executable_name,
                is_installed=False,
                error=f"Executable '{tool.executable_name}' not found in PATH"
            )
        
        # Get version information
        version = self._get_tool_version(tool.executable_name)
        
        return ToolInfo(
            name=tool.name,
            executable_name=tool.executable_name,
            is_installed=True,
            version=version,
            path=executable_path
        )
    
    def _get_tool_version(self, executable_name: str) -> Optional[str]:
        """Get version information for a tool."""
        try:
            # Different tools have different version command patterns
            version_commands = [
                f"{executable_name} --version",
                f"{executable_name} version",
                f"{executable_name} -v",
                f"{executable_name} -V"
            ]
            
            for cmd in version_commands:
                try:
                    result = subprocess.run(
                        cmd.split(),
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    
                    if result.returncode == 0:
                        version = result.stdout.strip()
                        # Clean up version string
                        if version.startswith(executable_name):
                            version = version.replace(executable_name, "").strip()
                        if version.startswith("version"):
                            version = version.replace("version", "").strip()
                        
                        return version.split("\n")[0] if version else "Unknown"
                        
                except subprocess.TimeoutExpired:
                    logger.warning(f"Timeout getting version for {executable_name}")
                    return "Unknown"
                except Exception as e:
                    logger.debug(f"Command '{cmd}' failed for {executable_name}: {e}")
                    continue
            
            logger.warning(f"Could not determine version for {executable_name}")
            return "Unknown"
            
        except Exception as e:
            logger.error(f"Error getting version for {executable_name}: {e}")
            return None
    
    def get_tool_by_name(self, tool_name: str) -> Optional[ToolInfo]:
        """Get a specific tool by name."""
        for tool in self.tools_to_detect:
            if tool.name == tool_name:
                return self._detect_tool(tool)
        return None
    
    def get_available_tools(self) -> List[str]:
        """Get list of available (installed) tool names."""
        result = self.detect_all_tools()
        return [tool.name for tool in result.tools if tool.is_installed]


# Pydantic models for API
class DetectionResponse(BaseModel):
    """Response model for tool detection."""
    
    success: bool
    message: str
    data: DetectionResult


class ToolStatusResponse(BaseModel):
    """Response model for individual tool status."""
    
    success: bool
    data: ToolInfo
    message: str


class VersionResponse(BaseModel):
    """Response model for version information."""
    
    success: bool
    data: Optional[str]
    message: str