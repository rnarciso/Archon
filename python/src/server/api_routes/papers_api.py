"""
API routes for paper management.
"""
import asyncio
import logging
from typing import Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel

from ..services.papers.paper_service import PaperService

logger = logging.getLogger(__name__)

# Global paper service instance
paper_service = PaperService()

router = APIRouter(prefix="/papers", tags=["papers"])

class SearchRequest(BaseModel):
    query: str
    max_results: int = 20
    start: int = 0

class TagRequest(BaseModel):
    doi: str

class DownloadResponse(BaseModel):
    success: bool
    doi: str
    filename: str = None
    filepath: str = None
    size: int = None
    error: str = None

class SearchResponse(BaseModel):
    query: str
    total_results: int
    papers: List[Dict]

@router.post("/search", response_model=SearchResponse)
async def search_papers(request: SearchRequest):
    """
    Search for papers on PubMed.
    
    Args:
        request: Search request containing query and pagination parameters
        
    Returns:
        Search results with paper metadata
    """
    try:
        results = await paper_service.search_and_tag(
            request.query, 
            request.max_results, 
            request.start
        )
        return results
    except Exception as e:
        logger.error(f"Error searching papers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching papers: {str(e)}")

@router.post("/tag")
async def tag_paper(request: TagRequest):
    """
    Tag a paper for download.
    
    Args:
        request: Tag request containing paper DOI
        
    Returns:
        Success message
    """
    try:
        tagged = paper_service.tag_paper(request.doi)
        if tagged:
            return {"message": f"Paper with DOI {request.doi} tagged for download"}
        else:
            return {"message": f"Paper with DOI {request.doi} was already tagged"}
    except Exception as e:
        logger.error(f"Error tagging paper: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error tagging paper: {str(e)}")

@router.delete("/tag")
async def untag_paper(request: TagRequest):
    """
    Remove a paper from the tagged list.
    
    Args:
        request: Tag request containing paper DOI
        
    Returns:
        Success message
    """
    try:
        untagged = paper_service.untag_paper(request.doi)
        if untagged:
            return {"message": f"Paper with DOI {request.doi} removed from download list"}
        else:
            return {"message": f"Paper with DOI {request.doi} was not in download list"}
    except Exception as e:
        logger.error(f"Error untagging paper: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error untagging paper: {str(e)}")

@router.get("/tagged")
async def get_tagged_papers():
    """
    Get list of tagged paper DOIs.
    
    Returns:
        List of tagged paper DOIs
    """
    try:
        dois = paper_service.get_tagged_papers()
        return {"tagged_papers": dois, "count": len(dois)}
    except Exception as e:
        logger.error(f"Error getting tagged papers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting tagged papers: {str(e)}")

@router.post("/download")
async def download_tagged_papers(background_tasks: BackgroundTasks):
    """
    Download all tagged papers from Sci-Hub.
    
    Args:
        background_tasks: FastAPI background tasks handler
        
    Returns:
        Success message with download initiation confirmation
    """
    try:
        # Get tagged papers count
        tagged_count = len(paper_service.get_tagged_papers())
        if tagged_count == 0:
            return {"message": "No papers tagged for download"}
        
        # Start download in background
        background_tasks.add_task(_download_papers_background)
        return {
            "message": f"Started downloading {tagged_count} tagged papers in background",
            "tagged_count": tagged_count
        }
    except Exception as e:
        logger.error(f"Error initiating paper download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error initiating paper download: {str(e)}")

async def _download_papers_background():
    """
    Background task to download tagged papers.
    """
    try:
        logger.info("Starting background download of tagged papers")
        results = await paper_service.download_tagged_papers()
        logger.info(f"Background download completed with {len(results)} results")
    except Exception as e:
        logger.error(f"Error in background paper download: {str(e)}")

@router.get("/download/status")
async def get_download_status():
    """
    Get status of paper downloads.
    
    Returns:
        Download status information
    """
    # This would need to be implemented with proper status tracking
    return {"status": "Not implemented", "message": "Download status tracking not yet implemented"}

# Cleanup function to close services
async def cleanup():
    """Cleanup function to close services."""
    try:
        await paper_service.close()
        logger.info("Paper service closed successfully")
    except Exception as e:
        logger.error(f"Error closing paper service: {str(e)}")