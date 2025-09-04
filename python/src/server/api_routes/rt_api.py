"""
Real-time API for Archon

Handles:
- WebSocket connections for real-time updates
- Broadcasting messages to connected clients
"""

import asyncio
from typing import Any, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config.logfire_config import api_logger, safe_span

router = APIRouter(prefix="/api/rt", tags=["rt"])


class RealTimeManager:
    """Manages real-time updates via WebSockets."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket."""
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]):
        """Broadcast a message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for connection in disconnected:
            self.active_connections.remove(connection)


rt_manager = RealTimeManager()


@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await rt_manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        rt_manager.disconnect(websocket)
