"""
Sci-Hub service for downloading scientific papers.
"""
import asyncio
import logging
import os
import random
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

class SciHubService:
    """Service for downloading papers from Sci-Hub."""
    
    def __init__(self, download_dir: str = "downloads"):
        """
        Initialize the Sci-Hub service.
        
        Args:
            download_dir: Directory to save downloaded papers
        """
        self.download_dir = download_dir
        # Create download directory if it doesn't exist
        os.makedirs(self.download_dir, exist_ok=True)
        
        # List of Sci-Hub domains (these change frequently)
        self.scihub_domains = [
            "https://sci-hub.se/",
            "https://sci-hub.st/",
            "https://sci-hub.ru/",
        ]
        
        # User agents to rotate
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        ]
        
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def download_paper(self, doi: str, filename: Optional[str] = None) -> Dict:
        """
        Download a paper from Sci-Hub using its DOI.
        
        Args:
            doi: DOI of the paper to download
            filename: Optional filename for the downloaded paper
            
        Returns:
            Dictionary with download result information
        """
        try:
            # Select a random Sci-Hub domain
            scihub_url = random.choice(self.scihub_domains)
            logger.info(f"Using Sci-Hub domain: {scihub_url}")
            
            # Set headers with random user agent
            headers = {
                "User-Agent": random.choice(self.user_agents),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
            
            # Search for the paper on Sci-Hub
            search_url = urljoin(scihub_url, doi)
            logger.info(f"Searching for paper with DOI: {doi}")
            
            response = await self.client.get(search_url, headers=headers)
            response.raise_for_status()
            
            # Parse the response to find the PDF URL
            pdf_url = await self._extract_pdf_url(response.text, scihub_url)
            
            if not pdf_url:
                return {
                    "success": False,
                    "doi": doi,
                    "error": "Could not find PDF URL in Sci-Hub response"
                }
            
            # Download the PDF
            logger.info(f"Downloading PDF from: {pdf_url}")
            pdf_response = await self.client.get(pdf_url, headers=headers)
            pdf_response.raise_for_status()
            
            # Generate filename if not provided
            if not filename:
                # Use DOI as filename, replacing invalid characters
                filename = f"{doi.replace('/', '_')}.pdf"
            
            # Save the PDF
            filepath = os.path.join(self.download_dir, filename)
            with open(filepath, "wb") as f:
                f.write(pdf_response.content)
            
            logger.info(f"Successfully downloaded paper to: {filepath}")
            
            return {
                "success": True,
                "doi": doi,
                "filename": filename,
                "filepath": filepath,
                "size": len(pdf_response.content)
            }
            
        except Exception as e:
            logger.error(f"Error downloading paper with DOI {doi}: {str(e)}")
            return {
                "success": False,
                "doi": doi,
                "error": str(e)
            }
    
    async def download_papers(self, dois: List[str]) -> List[Dict]:
        """
        Download multiple papers from Sci-Hub.
        
        Args:
            dois: List of DOIs to download
            
        Returns:
            List of download results
        """
        results = []
        
        # Download papers with a delay between requests to be respectful
        for i, doi in enumerate(dois):
            if i > 0:
                # Add a small delay between requests
                await asyncio.sleep(random.uniform(1, 3))
            
            result = await self.download_paper(doi)
            results.append(result)
        
        return results
    
    async def _extract_pdf_url(self, html_content: str, scihub_url: str) -> Optional[str]:
        """
        Extract the PDF URL from Sci-Hub HTML response.
        
        Args:
            html_content: HTML content from Sci-Hub
            scihub_url: Base Sci-Hub URL
            
        Returns:
            PDF URL if found, None otherwise
        """
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Look for iframe with PDF source
            iframe = soup.find('iframe', id='pdf')
            if iframe and iframe.get('src'):
                pdf_src = iframe['src']
                # Handle relative URLs
                if pdf_src.startswith('//'):
                    return f"https:{pdf_src}"
                elif pdf_src.startswith('/'):
                    return urljoin(scihub_url, pdf_src)
                else:
                    return pdf_src
            
            # Alternative: look for embedded object
            embed = soup.find('embed', type='application/pdf')
            if embed and embed.get('src'):
                pdf_src = embed['src']
                # Handle relative URLs
                if pdf_src.startswith('//'):
                    return f"https:{pdf_src}"
                elif pdf_src.startswith('/'):
                    return urljoin(scihub_url, pdf_src)
                else:
                    return pdf_src
            
            # Alternative: look for direct link in meta tags
            meta_pdf = soup.find('meta', {'name': 'citation_pdf_url'})
            if meta_pdf and meta_pdf.get('content'):
                return meta_pdf['content']
            
            # If we can't find the PDF URL, return None
            return None
            
        except Exception as e:
            logger.error(f"Error extracting PDF URL: {str(e)}")
            return None
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

# Example usage:
# async def main():
#     service = SciHubService()
#     try:
#         result = await service.download_paper("10.1038/nature12373")
#         print(result)
#     finally:
#         await service.close()
#
# if __name__ == "__main__":
#     asyncio.run(main())