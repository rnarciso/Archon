"""
Main paper service that integrates PubMed search and Sci-Hub download functionality.
"""
import asyncio
import logging
from typing import Dict, List, Set
from .pubmed_service import PubMedService
from .scihub_service import SciHubService

logger = logging.getLogger(__name__)

class PaperService:
    """Main service for managing scientific papers."""
    
    def __init__(self, download_dir: str = "downloads"):
        """
        Initialize the paper service.
        
        Args:
            download_dir: Directory to save downloaded papers
        """
        self.pubmed_service = PubMedService()
        self.scihub_service = SciHubService(download_dir)
        self.tagged_papers: Set[str] = set()  # Store DOIs of tagged papers
    
    async def search_papers(self, query: str, max_results: int = 20, start: int = 0) -> Dict:
        """
        Search for papers on PubMed.
        
        Args:
            query: Search query string
            max_results: Maximum number of results to return
            start: Starting index for pagination
            
        Returns:
            Dictionary containing search results
        """
        return await self.pubmed_service.search_papers(query, max_results, start)
    
    def tag_paper(self, doi: str) -> bool:
        """
        Tag a paper for download.
        
        Args:
            doi: DOI of the paper to tag
            
        Returns:
            True if paper was tagged, False if it was already tagged
        """
        if doi in self.tagged_papers:
            return False
        
        self.tagged_papers.add(doi)
        logger.info(f"Tagged paper with DOI: {doi}")
        return True
    
    def untag_paper(self, doi: str) -> bool:
        """
        Remove a paper from the tagged list.
        
        Args:
            doi: DOI of the paper to untag
            
        Returns:
            True if paper was untagged, False if it wasn't tagged
        """
        if doi not in self.tagged_papers:
            return False
        
        self.tagged_papers.discard(doi)
        logger.info(f"Untagged paper with DOI: {doi}")
        return True
    
    def get_tagged_papers(self) -> List[str]:
        """
        Get list of tagged paper DOIs.
        
        Returns:
            List of DOIs for tagged papers
        """
        return list(self.tagged_papers)
    
    async def download_tagged_papers(self) -> List[Dict]:
        """
        Download all tagged papers from Sci-Hub.
        
        Returns:
            List of download results
        """
        if not self.tagged_papers:
            logger.info("No tagged papers to download")
            return []
        
        logger.info(f"Downloading {len(self.tagged_papers)} tagged papers")
        results = await self.scihub_service.download_papers(list(self.tagged_papers))
        
        # Clear tagged papers after download
        downloaded_count = sum(1 for result in results if result.get("success"))
        logger.info(f"Successfully downloaded {downloaded_count} out of {len(results)} papers")
        
        return results
    
    async def search_and_tag(self, query: str, max_results: int = 20) -> Dict:
        """
        Search for papers and return results with tagging status.
        
        Args:
            query: Search query string
            max_results: Maximum number of results to return
            
        Returns:
            Dictionary containing search results with tagging status
        """
        search_results = await self.search_papers(query, max_results)
        
        # Add tagging status to each paper
        for paper in search_results.get("papers", []):
            doi = paper.get("doi")
            if doi:
                paper["tagged"] = doi in self.tagged_papers
            else:
                paper["tagged"] = False
                paper["tag_error"] = "No DOI available"
        
        return search_results
    
    async def close(self):
        """Close all services."""
        await self.pubmed_service.close()
        await self.scihub_service.close()

# Example usage:
# async def main():
#     service = PaperService()
#     try:
#         # Search for papers
#         results = await service.search_and_tag("machine learning", max_results=5)
#         print(f"Found {results['total_results']} papers")
#         
#         # Tag first paper with DOI
#         for paper in results["papers"]:
#             if paper.get("doi"):
#                 service.tag_paper(paper["doi"])
#                 print(f"Tagged paper: {paper['title']}")
#                 break
#         
#         # Download tagged papers
#         download_results = await service.download_tagged_papers()
#         print(f"Download results: {download_results}")
#     finally:
#         await service.close()
#
# if __name__ == "__main__":
#     asyncio.run(main())