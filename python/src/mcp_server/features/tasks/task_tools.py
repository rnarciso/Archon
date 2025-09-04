"""
Simple task management tools for Archon MCP Server.

Provides separate, focused tools for each task operation.
Mirrors the functionality of the original manage_task tool but with individual tools.
"""

import json
import logging
from http import HTTPStatus
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin
import uuid

import httpx
from mcp.server.fastmcp import Context, FastMCP

from src.mcp_server.utils.error_handling import MCPErrorFormatter
from src.mcp_server.utils.timeout_config import get_default_timeout
from src.server.config.service_discovery import get_api_url

logger = logging.getLogger(__name__)


def register_task_tools(mcp: FastMCP):
    """Register individual task management tools with the MCP server."""

    @mcp.tool()
    async def create_task(
        ctx: Context,
        project_id: str,
        title: str,
        description: str = "",
        assignee: str = "User",
        task_order: int = 0,
        feature: Optional[str] = None,
        sources: Optional[List[Dict[str, str]]] = None,
        code_examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Create a new task in a project.

        Args:
            project_id: Project UUID (required)
            title: Task title - should be specific and actionable (required)
            description: Detailed task description with acceptance criteria
            assignee: Who will work on this task. Options:
                - "User": For manual tasks
                - "Archon": For AI-driven tasks
                - "AI IDE Agent": For code implementation
                - "prp-executor": For PRP coordination
                - "prp-validator": For testing/validation
            task_order: Priority within status (0-100, higher = more priority)
            feature: Feature label for grouping related tasks (e.g., "authentication")
            sources: List of source references. Each source should have:
                - "url": Link to documentation or file path
                - "type": Type of source (e.g., "documentation", "api_spec")
                - "relevance": Why this source is relevant
            code_examples: List of code examples. Each example should have:
                - "file": Path to the file
                - "function": Function or class name
                - "purpose": Why this example is relevant

        Returns:
            JSON with task details including task_id:
            {
                "success": true,
                "task": {...},
                "task_id": "task-123",
                "message": "Task created successfully"
            }

        Examples:
            # Simple task
            create_task(
                project_id="550e8400-e29b-41d4-a716-446655440000",
                title="Add user authentication",
                description="Implement JWT-based authentication with refresh tokens"
            )

            # Task with sources and examples
            create_task(
                project_id="550e8400-e29b-41d4-a716-446655440000",
                title="Implement OAuth2 Google provider",
                description="Add Google OAuth2 with PKCE security",
                assignee="AI IDE Agent",
                task_order=10,
                feature="authentication",
                sources=[
                    {
                        "url": "https://developers.google.com/identity/protocols/oauth2",
                        "type": "documentation",
                        "relevance": "Official OAuth2 implementation guide"
                    },
                    {
                        "url": "docs/auth/README.md",
                        "type": "internal_docs",
                        "relevance": "Current auth architecture"
                    }
                ],
                code_examples=[
                    {
                        "file": "src/auth/base.py",
                        "function": "BaseAuthProvider",
                        "purpose": "Base class to extend"
                    },
                    {
                        "file": "tests/auth/test_oauth.py",
                        "function": "test_oauth_flow",
                        "purpose": "Test pattern to follow"
                    }
                ]
            )
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    urljoin(api_url, "/api/tasks"),
                    json={
                        "project_id": project_id,
                        "title": title,
                        "description": description,
                        "assignee": assignee,
                        "task_order": task_order,
                        "feature": feature,
                        "sources": sources or [],
                        "code_examples": code_examples or [],
                    },
                )

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps({
                        "success": True,
                        "task": result.get("task"),
                        "task_id": result.get("task", {}).get("id"),
                        "message": result.get("message", "Task created successfully"),
                    })
                else:
                    return MCPErrorFormatter.from_http_error(response, "create task")

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, "create task", {"project_id": project_id, "title": title}
            )
        except Exception as e:
            logger.error(f"Error creating task: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "create task")

    @mcp.tool()
    async def list_tasks(
        ctx: Context,
        filter_by: Optional[str] = None,
        filter_value: Optional[str] = None,
        project_id: Optional[str] = None,
        include_closed: bool = False,
        page: int = 1,
        per_page: int = 50,
    ) -> str:
        """
        List tasks with filtering options.

        Args:
            filter_by: "status" | "project" | "assignee" (optional)
            filter_value: Filter value (e.g., "todo", "doing", "review", "done")
            project_id: Project UUID (optional, for additional filtering)
            include_closed: Include done tasks in results
            page: Page number for pagination
            per_page: Items per page

        Returns:
            JSON array of tasks with pagination info

        Examples:
            list_tasks() # All tasks
            list_tasks(filter_by="status", filter_value="todo") # Only todo tasks
            list_tasks(filter_by="project", filter_value="project-uuid") # Tasks for specific project
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()

            # Build URL and parameters based on filter type
            params: Dict[str, Any] = {
                "page": page,
                "per_page": per_page,
                "exclude_large_fields": True,  # Always exclude large fields in MCP responses
            }

            if filter_by == "project" and filter_value:
                # Use project-specific endpoint for project filtering
                url = urljoin(api_url, f"/api/projects/{filter_value}/tasks")
                params["include_archived"] = False  # For backward compatibility
            elif filter_by == "status" and filter_value:
                # Use generic tasks endpoint for status filtering
                url = urljoin(api_url, "/api/tasks")
                params["status"] = filter_value
                params["include_closed"] = include_closed
                if project_id:
                    params["project_id"] = project_id
            else:
                # Default to generic tasks endpoint
                url = urljoin(api_url, "/api/tasks")
                params["include_closed"] = include_closed
                if project_id:
                    params["project_id"] = project_id

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()

                result = response.json()

                # Normalize response format - handle both array and object responses
                if isinstance(result, list):
                    # Direct array response
                    tasks = result
                    total_count = len(result)
                elif isinstance(result, dict):
                    # Object response - check for standard fields
                    if "tasks" in result:
                        tasks = result["tasks"]
                        total_count = result.get("total_count", len(tasks))
                    elif "data" in result:
                        # Alternative format with 'data' field
                        tasks = result["data"]
                        total_count = result.get("total", len(tasks))
                    else:
                        # Unknown object format
                        return MCPErrorFormatter.format_error(
                            error_type="invalid_response",
                            message="Unexpected response format from API",
                            details={"response_keys": list(result.keys())},
                            suggestion="The API response format may have changed. Please check for updates.",
                        )
                else:
                    # Completely unexpected format
                    return MCPErrorFormatter.format_error(
                        error_type="invalid_response",
                        message="Invalid response type from API",
                        details={"response_type": type(result).__name__},
                        suggestion="Expected list or object, got different type.",
                    )

                return json.dumps({
                    "success": True,
                    "tasks": tasks,
                    "total_count": total_count,
                    "count": len(tasks),
                })

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, "list tasks", {"filter_by": filter_by, "filter_value": filter_value}
            )
        except Exception as e:
            logger.error(f"Error listing tasks: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "list tasks")

    @mcp.tool()
    async def get_task(ctx: Context, task_id: str) -> str:
        """
        Get detailed information about a specific task.

        Args:
            task_id: UUID of the task

        Returns:
            JSON with complete task details

        Example:
            get_task(task_id="task-uuid")
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(urljoin(api_url, f"/api/tasks/{task_id}"))

                if response.status_code == 200:
                    task = response.json()
                    return json.dumps({"success": True, "task": task})
                elif response.status_code == 404:
                    return MCPErrorFormatter.format_error(
                        error_type="not_found",
                        message=f"Task {task_id} not found",
                        suggestion="Verify the task ID is correct",
                        http_status=404,
                    )
                else:
                    return MCPErrorFormatter.from_http_error(response, "get task")

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(e, "get task", {"task_id": task_id})
        except Exception as e:
            logger.error(f"Error getting task: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "get task")

    @mcp.tool()
    async def update_task(
        ctx: Context,
        task_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        assignee: Optional[str] = None,
        task_order: Optional[int] = None,
        feature: Optional[str] = None,
        sources: Optional[List[Dict[str, str]]] = None,
        code_examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Update a task's properties.

        Args:
            task_id: UUID of the task to update
            title: New title (optional)
            description: New description (optional)
            status: New status - "todo" | "doing" | "review" | "done" (optional)
            assignee: New assignee (optional)
            task_order: New priority order (optional)
            feature: New feature label (optional)
            sources: New source references (optional)
            code_examples: New code examples (optional)

        Returns:
            JSON with updated task details

        Examples:
            update_task(task_id="uuid", status="doing")
            update_task(task_id="uuid", title="New Title", description="Updated description")
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()

            # Build update_fields dict from provided parameters
            update_fields = {}
            if title is not None:
                update_fields["title"] = title
            if description is not None:
                update_fields["description"] = description
            if status is not None:
                update_fields["status"] = status
            if assignee is not None:
                update_fields["assignee"] = assignee
            if task_order is not None:
                update_fields["task_order"] = task_order
            if feature is not None:
                update_fields["feature"] = feature
            if sources is not None:
                update_fields["sources"] = sources
            if code_examples is not None:
                update_fields["code_examples"] = code_examples

            if not update_fields:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="No fields to update",
                    suggestion="Provide at least one field to update",
                )

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.put(
                    urljoin(api_url, f"/api/tasks/{task_id}"), json=update_fields
                )

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps({
                        "success": True,
                        "task": result.get("task"),
                        "message": result.get("message", "Task updated successfully"),
                    })
                else:
                    return MCPErrorFormatter.from_http_error(response, "update task")

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, "update task", {"task_id": task_id, "update_fields": list(update_fields.keys())}
            )
        except Exception as e:
            logger.error(f"Error updating task: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "update task")

    @mcp.tool()
    async def delete_task(ctx: Context, task_id: str) -> str:
        """
        Delete/archive a task.

        This removes the task from active lists but preserves it in the database
        for audit purposes (soft delete).

        Args:
            task_id: UUID of the task to delete/archive

        Returns:
            JSON confirmation of deletion:
            {
                "success": true,
                "message": "Task deleted successfully",
                "subtasks_archived": 0
            }

        Example:
            delete_task(task_id="task-123e4567-e89b-12d3-a456-426614174000")
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.delete(urljoin(api_url, f"/api/tasks/{task_id}"))

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps({
                        "success": True,
                        "message": result.get("message", f"Task {task_id} deleted successfully"),
                        "subtasks_archived": result.get("subtasks_archived", 0),
                    })
                elif response.status_code == 404:
                    return json.dumps({
                        "success": False,
                        "error": f"Task {task_id} not found. Use list_tasks to find valid task IDs.",
                    })
                elif response.status_code == 400:
                    # More specific error for bad requests
                    error_text = response.text
                    if "already archived" in error_text.lower():
                        return MCPErrorFormatter.format_error(
                            error_type="already_archived",
                            message=f"Task {task_id} is already archived",
                            suggestion="No further action needed - task is already archived",
                            http_status=400,
                        )
                    return MCPErrorFormatter.format_error(
                        error_type="validation_error",
                        message=f"Cannot delete task: {error_text}",
                        suggestion="Check if the task meets deletion requirements",
                        http_status=400,
                    )
                else:
                    return MCPErrorFormatter.from_http_error(response, "delete task")

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(e, "delete task", {"task_id": task_id})
        except Exception as e:
            logger.error(f"Error deleting task: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "delete task")

    @mcp.tool()
    async def deploy_agent(ctx: Context, project_id: str, task_id: str) -> str:
        """
        Deploy an AI agent to work on a specific task.

        Args:
            project_id: UUID of the project
            task_id: UUID of the task to deploy the agent on

        Returns:
            JSON confirmation of the deployment
        """
        try:
            # 1. Validate UUIDs
            try:
                uuid.UUID(project_id)
                uuid.UUID(task_id)
            except ValueError:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="Invalid project_id or task_id format. Must be a valid UUID.",
                    http_status=HTTPStatus.BAD_REQUEST,
                )

            # 2. Placeholder for Permissions Logic
            # In a real application, you would check if the current user (from ctx.auth or similar)
            # has permissions to access this project and deploy agents to its tasks.
            # For example:
            # if not await check_user_project_permission(ctx.user, project_id, "deploy_agent"):
            #     return MCPErrorFormatter.format_error(
            #         error_type="permission_denied",
            #         message="User does not have permission to deploy agents to this project.",
            #         http_status=HTTPStatus.FORBIDDEN,
            #     )
            logger.info(f"Permissions check placeholder: User has access to project {project_id} and task {task_id}")

            api_url = get_api_url()
            timeout = get_default_timeout()

            # Update task status to 'doing' (in-progress)
            try:
                await client.put(
                    urljoin(api_url, f"/api/tasks/{task_id}"),
                    json={"status": "doing"}
                )
                logger.info(f"Task {task_id} status updated to 'doing' (in-progress).")
            except httpx.RequestError as e:
                logger.error(f"Failed to update task status to 'doing' for task {task_id}: {e}")
                return MCPErrorFormatter.from_exception(
                    e, "update task status", {"task_id": task_id, "status": "doing"}
                )

            async with httpx.AsyncClient(timeout=timeout) as client:
                # Call the backend service to execute the agent script
                response = await client.post(
                    urljoin(api_url, f"/api/tasks/{task_id}/execute-agent"),
                    json={"project_id": project_id, "task_id": task_id}
                )

                if response.status_code == 200:
                    return json.dumps({
                        "success": True,
                        "message": f"Agent deployed to task {task_id} in project {project_id} successfully.",
                    })
                elif response.status_code == 404:
                    return MCPErrorFormatter.format_error(
                        error_type="not_found",
                        message=f"Task {task_id} or Project {project_id} not found",
                        suggestion="Verify the project and task IDs are correct",
                        http_status=HTTPStatus.NOT_FOUND,
                    )
                elif response.status_code == HTTPStatus.FORBIDDEN:
                    return MCPErrorFormatter.format_error(
                        error_type="permission_denied",
                        message="You do not have permission to deploy agents to this task.",
                        http_status=HTTPStatus.FORBIDDEN,
                    )
                else:
                    return MCPErrorFormatter.from_http_error(response, "deploy agent")

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, "deploy agent", {"project_id": project_id, "task_id": task_id}
            )
        except Exception as e:
            logger.error(f"Error deploying agent: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "deploy agent")

    @mcp.tool()
    async def update_task_status_callback(
        ctx: Context,
        task_id: str,
        status: str,
        details: Optional[str] = None,
    ) -> str:
        """
        Callback endpoint for agent script to update task status.

        Args:
            task_id: UUID of the task to update
            status: New status for the task (e.g., "completed", "error")
            details: Optional details or error message

        Returns:
            JSON confirmation of the update
        """
        try:
            # 1. Validate UUID
            try:
                uuid.UUID(task_id)
            except ValueError:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="Invalid task_id format. Must be a valid UUID.",
                    http_status=HTTPStatus.BAD_REQUEST,
                )

            # 2. Validate status
            valid_statuses = ["completed", "error"]
            if status not in valid_statuses:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message=f"Invalid status: {status}. Must be one of {valid_statuses}.",
                    http_status=HTTPStatus.BAD_REQUEST,
                )

            api_url = get_api_url()
            timeout = get_default_timeout()

            async with httpx.AsyncClient(timeout=timeout) as client:
                # Update task status using the existing update_task API
                update_payload = {"status": status}
                if details:
                    update_payload["description"] = details # Or a dedicated field for agent output

                response = await client.put(
                    urljoin(api_url, f"/api/tasks/{task_id}"),
                    json=update_payload
                )

                if response.status_code == 200:
                    return json.dumps({
                        "success": True,
                        "message": f"Task {task_id} status updated to {status} successfully.",
                    })
                elif response.status_code == 404:
                    return MCPErrorFormatter.format_error(
                        error_type="not_found",
                        message=f"Task {task_id} not found",
                        suggestion="Verify the task ID is correct",
                        http_status=HTTPStatus.NOT_FOUND,
                    )
                else:
                    return MCPErrorFormatter.from_http_error(response, "update task status callback")

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, "update task status callback", {"task_id": task_id, "status": status}
            )
        except Exception as e:
            logger.error(f"Error in update_task_status_callback: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "update task status callback")
