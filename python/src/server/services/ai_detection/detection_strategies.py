"""
Detection strategies for different AI tools
"""

import shutil
import subprocess
import re
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

from ..config.logfire_config import get_logger
from .models import DetectedTool, ToolStatus, ToolType

logger = get_logger(__name__)


class DetectionStrategy:
    """Base class for tool detection strategies"""
    
    def __init__(self, tool_name: str, tool_type: ToolType):
        self.tool_name = tool_name
        self.tool_type = tool_type
    
    async def detect(self) -> DetectedTool:
        """Detect if the tool is available and return details"""
        raise NotImplementedError
    
    async def get_version(self, executable_path: str) -> Optional[str]:
        """Get version information from the tool"""
        try:
            process = await asyncio.create_subprocess_exec(
                executable_path, "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                version_output = stdout.decode('utf-8', errors='ignore').strip()
                return self._extract_version(version_output)
            
            # Try alternative version commands
            if "claude" in self.tool_name.lower():
                # Try with different flags
                for flag in ["-V", "version", "info"]:
                    try:
                        process = await asyncio.create_subprocess_exec(
                            executable_path, flag,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE
                        )
                        stdout, stderr = await process.communicate()
                        
                        if process.returncode == 0:
                            version_output = stdout.decode('utf-8', errors='ignore').strip()
                            version = self._extract_version(version_output)
                            if version:
                                return version
                    except Exception:
                        continue
            
            return None
            
        except Exception as e:
            logger.warning(f"Failed to get version for {self.tool_name}: {e}")
            return None
    
    def _extract_version(self, version_output: str) -> Optional[str]:
        """Extract version from tool output"""
        # Common version patterns
        patterns = [
            r'version\s+([0-9]+\.[0-9]+\.[0-9]+)',
            r'v([0-9]+\.[0-9]+\.[0-9]+)',
            r'([0-9]+\.[0-9]+\.[0-9]+)',
            r'([0-9]+\.[0-9]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, version_output, re.IGNORECASE)
            if match:
                return match.group(1)
        
        # If no pattern matches, return the first line (might contain version info)
        first_line = version_output.split('\n')[0].strip()
        if first_line and not first_line.startswith('ERROR') and len(first_line) < 100:
            return first_line
        
        return None


class ClaudeCodeDetectionStrategy(DetectionStrategy):
    """Detection strategy for Claude Code CLI"""
    
    def __init__(self):
        super().__init__("Claude Code", ToolType.CLAUDE_CODE)
    
    async def detect(self) -> DetectedTool:
        """Detect Claude Code CLI"""
        executable = "claude"
        
        try:
            # Check if executable exists
            path = shutil.which(executable)
            if not path:
                logger.debug(f"Claude Code CLI not found in PATH")
                return DetectedTool(
                    name=self.tool_name,
                    tool_type=self.tool_type,
                    status=ToolStatus.MISSING,
                    metadata={"reason": "Not found in PATH"}
                )
            
            # Get version
            version = await self.get_version(path)
            if version is None:
                logger.warning(f"Claude Code CLI found but version check failed")
                return DetectedTool(
                    name=self.tool_name,
                    tool_type=self.tool_type,
                    status=ToolStatus.ERROR,
                    executable_path=path,
                    metadata={"reason": "Version check failed"}
                )
            
            logger.info(f"Detected Claude Code CLI at {path}, version {version}")
            return DetectedTool(
                name=self.tool_name,
                tool_type=self.tool_type,
                status=ToolStatus.AVAILABLE,
                executable_path=path,
                version=version,
                metadata={"command": "claude"}
            )
            
        except Exception as e:
            logger.error(f"Error detecting Claude Code CLI: {e}")
            return DetectedTool(
                name=self.tool_name,
                tool_type=self.tool_type,
                status=ToolStatus.ERROR,
                metadata={"error": str(e)}
            )


class GeminiCLIDetectionStrategy(DetectionStrategy):
    """Detection strategy for Gemini CLI"""
    
    def __init__(self):
        super().__init__("Gemini CLI", ToolType.GEMINI_CLI)
    
    async def detect(self) -> DetectedTool:
        """Detect Gemini CLI"""
        executable = "gemini"
        
        try:
            # Check if executable exists
            path = shutil.which(executable)
            if not path:
                logger.debug(f"Gemini CLI not found in PATH")
                return DetectedTool(
                    name=self.tool_name,
                    tool_type=self.tool_type,
                    status=ToolStatus.MISSING,
                    metadata={"reason": "Not found in PATH"}
                )
            
            # Get version
            version = await self.get_version(path)
            if version is None:
                logger.warning(f"Gemini CLI found but version check failed")
                return DetectedTool(
                    name=self.tool_name,
                    tool_type=self.tool_type,
                    status=ToolStatus.ERROR,
                    executable_path=path,
                    metadata={"reason": "Version check failed"}
                )
            
            logger.info(f"Detected Gemini CLI at {path}, version {version}")
            return DetectedTool(
                name=self.tool_name,
                tool_type=self.tool_type,
                status=ToolStatus.AVAILABLE,
                executable_path=path,
                version=version,
                metadata={"command": "gemini"}
            )
            
        except Exception as e:
            logger.error(f"Error detecting Gemini CLI: {e}")
            return DetectedTool(
                name=self.tool_name,
                tool_type=self.tool_type,
                status=ToolStatus.ERROR,
                metadata={"error": str(e)}
            )


class QwenCodeDetectionStrategy(DetectionStrategy):
    """Detection strategy for Qwen Code"""
    
    def __init__(self):
        super().__init__("Qwen Code", ToolType.QWEN_CODE)
    
    async def detect(self) -> DetectedTool:
        """Detect Qwen Code"""
        executable = "qwen-code"
        
        try:
            # Check if executable exists
            path = shutil.which(executable)
            if not path:
                logger.debug(f"Qwen Code not found in PATH")
                return DetectedTool(
                    name=self.tool_name,
                    tool_type=self.tool_type,
                    status=ToolStatus.MISSING,
                    metadata={"reason": "Not found in PATH"}
                )
            
            # Get version
            version = await self.get_version(path)
            if version is None:
                logger.warning(f"Qwen Code found but version check failed")
                return DetectedTool(
                    name=self.tool_name,
                    tool_type=self.tool_type,
                    status=ToolStatus.ERROR,
                    executable_path=path,
                    metadata={"reason": "Version check failed"}
                )
            
            logger.info(f"Detected Qwen Code at {path}, version {version}")
            return DetectedTool(
                name=self.tool_name,
                tool_type=self.tool_type,
                status=ToolStatus.AVAILABLE,
                executable_path=path,
                version=version,
                metadata={"command": "qwen-code"}
            )
            
        except Exception as e:
            logger.error(f"Error detecting Qwen Code: {e}")
            return DetectedTool(
                name=self.tool_name,
                tool_type=self.tool_type,
                status=ToolStatus.ERROR,
                metadata={"error": str(e)}
            )


class DetectionStrategyFactory:
    """Factory for creating detection strategies"""
    
    _strategies: Dict[ToolType, type] = {
        ToolType.CLAUDE_CODE: ClaudeCodeDetectionStrategy,
        ToolType.GEMINI_CLI: GeminiCLIDetectionStrategy,
        ToolType.QWEN_CODE: QwenCodeDetectionStrategy,
    }
    
    @classmethod
    def create_strategy(cls, tool_type: ToolType) -> DetectionStrategy:
        """Create a detection strategy for the specified tool type"""
        strategy_class = cls._strategies.get(tool_type)
        if not strategy_class:
            raise ValueError(f"No detection strategy found for tool type: {tool_type}")
        return strategy_class()
    
    @classmethod
    def get_supported_tools(cls) -> list[ToolType]:
        """Get list of supported tool types"""
        return list(cls._strategies.keys())