"""
Detection strategies for different AI tools with container support
"""

import shutil
import subprocess
import re
import asyncio
import os
from typing import Dict, Any, Optional
from datetime import datetime

from ...config.logfire_config import get_logger
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
    
    async def _check_docker_container(self, container_name: str) -> bool:
        """Check if a Docker container is running"""
        try:
            process = await asyncio.create_subprocess_exec(
                "docker", "ps", "--format", "{{.Names}}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                containers = stdout.decode('utf-8', errors='ignore').strip().split('\n')
                return container_name in containers
            return False
        except Exception:
            return False
    
    async def _check_docker_image(self, image_name: str) -> bool:
        """Check if a Docker image exists"""
        try:
            process = await asyncio.create_subprocess_exec(
                "docker", "images", "--format", "{{.Repository}}:{{.Tag}}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                images = stdout.decode('utf-8', errors='ignore').strip().split('\n')
                return any(image_name in image for image in images)
            return False
        except Exception:
            return False


class ClaudeCodeDetectionStrategy(DetectionStrategy):
    """Detection strategy for Claude Code CLI with container support"""
    
    def __init__(self):
        super().__init__("Claude Code", ToolType.CLAUDE_CODE)
    
    async def detect(self) -> DetectedTool:
        """Detect Claude Code CLI with container support"""
        executable = "claude"
        
        try:
            # First check if it's a direct executable
            path = shutil.which(executable)
            if path:
                # Try to get version
                version = await self.get_version(path)
                if version is not None:
                    logger.info(f"Detected Claude Code CLI at {path}, version {version}")
                    return DetectedTool(
                        name=self.tool_name,
                        tool_type=self.tool_type,
                        status=ToolStatus.AVAILABLE,
                        executable_path=path,
                        version=version,
                        metadata={"command": "claude", "type": "executable"}
                    )
            
            # Check if it's an alias or script that works
            try:
                process = await asyncio.create_subprocess_exec(
                    "claude", "--help",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate(timeout=5)
                
                if process.returncode == 0 or process.returncode == 1:  # Help commands often return 1
                    # Try to get version through the alias
                    version = await self.get_version("claude")
                    logger.info(f"Detected Claude Code CLI via alias, version {version or 'unknown'}")
                    return DetectedTool(
                        name=self.tool_name,
                        tool_type=self.tool_type,
                        status=ToolStatus.AVAILABLE,
                        executable_path="claude",
                        version=version,
                        metadata={"command": "claude", "type": "alias"}
                    )
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass
            
            # Check for Docker container
            if await self._check_docker_container("claude-code") or await self._check_docker_image("claude-code"):
                logger.info("Detected Claude Code via Docker container")
                return DetectedTool(
                    name=self.tool_name,
                    tool_type=self.tool_type,
                    status=ToolStatus.AVAILABLE,
                    executable_path="docker",
                    version="container",
                    metadata={"command": "claude", "type": "docker", "container": "claude-code"}
                )
            
            logger.debug("Claude Code CLI not found")
            return DetectedTool(
                name=self.tool_name,
                tool_type=self.tool_type,
                status=ToolStatus.MISSING,
                metadata={"reason": "Not found in PATH or as alias"}
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
    """Detection strategy for Gemini CLI with container support"""
    
    def __init__(self):
        super().__init__("Gemini CLI", ToolType.GEMINI_CLI)
    
    async def detect(self) -> DetectedTool:
        """Detect Gemini CLI with container support"""
        executable = "gemini"
        
        try:
            # First check if it's a direct executable
            path = shutil.which(executable)
            if path:
                # Try to get version
                version = await self.get_version(path)
                if version is not None:
                    logger.info(f"Detected Gemini CLI at {path}, version {version}")
                    return DetectedTool(
                        name=self.tool_name,
                        tool_type=self.tool_type,
                        status=ToolStatus.AVAILABLE,
                        executable_path=path,
                        version=version,
                        metadata={"command": "gemini", "type": "executable"}
                    )
            
            # Check if it's an alias or script that works
            try:
                process = await asyncio.create_subprocess_exec(
                    "gemini", "--help",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate(timeout=5)
                
                if process.returncode == 0 or process.returncode == 1:  # Help commands often return 1
                    # Try to get version through the alias
                    version = await self.get_version("gemini")
                    logger.info(f"Detected Gemini CLI via alias, version {version or 'unknown'}")
                    return DetectedTool(
                        name=self.tool_name,
                        tool_type=self.tool_type,
                        status=ToolStatus.AVAILABLE,
                        executable_path="gemini",
                        version=version,
                        metadata={"command": "gemini", "type": "alias"}
                    )
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass
            
            # Check for Docker container
            if await self._check_docker_container("gemini-cli") or await self._check_docker_image("gemini-cli"):
                logger.info("Detected Gemini CLI via Docker container")
                return DetectedTool(
                    name=self.tool_name,
                    tool_type=self.tool_type,
                    status=ToolStatus.AVAILABLE,
                    executable_path="docker",
                    version="container",
                    metadata={"command": "gemini", "type": "docker", "container": "gemini-cli"}
                )
            
            logger.debug("Gemini CLI not found")
            return DetectedTool(
                name=self.tool_name,
                tool_type=self.tool_type,
                status=ToolStatus.MISSING,
                metadata={"reason": "Not found in PATH or as alias"}
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
    """Detection strategy for Qwen Code with container support"""
    
    def __init__(self):
        super().__init__("Qwen Code", ToolType.QWEN_CODE)
    
    async def detect(self) -> DetectedTool:
        """Detect Qwen Code with container support"""
        executable = "qwen-code"
        
        try:
            # First check if it's a direct executable
            path = shutil.which(executable)
            if path:
                # Try to get version
                version = await self.get_version(path)
                if version is not None:
                    logger.info(f"Detected Qwen Code at {path}, version {version}")
                    return DetectedTool(
                        name=self.tool_name,
                        tool_type=self.tool_type,
                        status=ToolStatus.AVAILABLE,
                        executable_path=path,
                        version=version,
                        metadata={"command": "qwen-code", "type": "executable"}
                    )
            
            # Check if it's an alias or script that works (try both qwen-code and qwen)
            for cmd in ["qwen-code", "qwen"]:
                try:
                    process = await asyncio.create_subprocess_exec(
                        cmd, "--help",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, stderr = await process.communicate(timeout=5)
                    
                    if process.returncode == 0 or process.returncode == 1:  # Help commands often return 1
                        # Try to get version through the alias
                        version = await self.get_version(cmd)
                        logger.info(f"Detected Qwen Code via alias '{cmd}', version {version or 'unknown'}")
                        return DetectedTool(
                            name=self.tool_name,
                            tool_type=self.tool_type,
                            status=ToolStatus.AVAILABLE,
                            executable_path=cmd,
                            version=version,
                            metadata={"command": cmd, "type": "alias"}
                        )
                except asyncio.TimeoutError:
                    pass
                except Exception:
                    pass
            
            # Check for Docker container
            container_names = ["qwen-code", "qwen"]
            for container_name in container_names:
                if await self._check_docker_container(container_name) or await self._check_docker_image(container_name):
                    logger.info(f"Detected Qwen Code via Docker container '{container_name}'")
                    return DetectedTool(
                        name=self.tool_name,
                        tool_type=self.tool_type,
                        status=ToolStatus.AVAILABLE,
                        executable_path="docker",
                        version="container",
                        metadata={"command": "qwen-code", "type": "docker", "container": container_name}
                    )
            
            logger.debug("Qwen Code not found")
            return DetectedTool(
                name=self.tool_name,
                tool_type=self.tool_type,
                status=ToolStatus.MISSING,
                metadata={"reason": "Not found in PATH or as alias"}
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