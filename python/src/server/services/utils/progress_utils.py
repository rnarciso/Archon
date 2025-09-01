"""
Utility functions for progress reporting.
"""

import asyncio
from typing import Any, Callable


def create_embedding_progress_wrapper(
    progress_callback: Callable | None,
    current_percentage: int,
    batch_num: int
) -> Callable | None:
    if not progress_callback:
        return None

    async def embedding_progress_wrapper(message: str, percentage: float):
        # Forward rate limiting messages to the main progress callback
        if "rate limit" in message.lower():
            await progress_callback(
                message,
                current_percentage,
                {"batch": batch_num, "type": "rate_limit_wait"}
            )
    
    return embedding_progress_wrapper


def create_embedding_rate_limit_callback(
    progress_callback: Callable | None,
    websocket: Any | None,
    result: Any, # EmbeddingBatchResult
    texts: list
) -> Callable | None:
    if not progress_callback and not websocket:
        return None

    async def rate_limit_callback(data: dict):
        # Send heartbeat during rate limit wait
        if progress_callback:
            processed = result.success_count + result.failure_count
            message = f"Rate limited: {data.get('message', 'Waiting...')}"
            await progress_callback(message, (processed / len(texts)) * 100)
        
        if websocket:
            await websocket.send_json({
                "type": "rate_limit_wait",
                "message": data.get("message", "Rate limited, waiting..."),
                "remaining_seconds": data.get("remaining_seconds", 0)
            })
    
    return rate_limit_callback