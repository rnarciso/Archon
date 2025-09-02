"""
PubMed service for searching scientific papers.
"""
import asyncio
import logging
from typing import Dict, List, Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

class PubMedService:
    """Service for interacting with PubMed API."""
    
    def __init__(self):
        self.base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
        self.client = httpx.AsyncClient(timeout=30.0)
    
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
        try:
            # Search for papers
            search_params = {
                "db": "pubmed",
                "term": query,
                "retmax": max_results,
                "retstart": start,
                "retmode": "json",
                "sort": "relevance"
            }
            
            search_url = f"{self.base_url}/esearch.fcgi?{urlencode(search_params)}"
            logger.info(f"Searching PubMed with query: {query}")
            
            search_response = await self.client.get(search_url)
            search_response.raise_for_status()
            search_data = search_response.json()
            
            # Extract PMIDs
            pmids = search_data.get("esearchresult", {}).get("idlist", [])
            
            if not pmids:
                return {
                    "query": query,
                    "total_results": 0,
                    "papers": []
                }
            
            # Fetch paper details
            papers = await self._fetch_paper_details(pmids)
            
            return {
                "query": query,
                "total_results": int(search_data.get("esearchresult", {}).get("count", 0)),
                "papers": papers
            }
            
        except Exception as e:
            logger.error(f"Error searching PubMed: {str(e)}")
            raise
    
    async def _fetch_paper_details(self, pmids: List[str]) -> List[Dict]:
        """
        Fetch detailed information for a list of PMIDs.
        
        Args:
            pmids: List of PubMed IDs
            
        Returns:
            List of paper details
        """
        try:
            # Fetch paper details
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(pmids),
                "retmode": "xml"
            }
            
            fetch_url = f"{self.base_url}/efetch.fcgi?{urlencode(fetch_params)}"
            logger.info(f"Fetching details for {len(pmids)} papers")
            
            fetch_response = await self.client.get(fetch_url)
            fetch_response.raise_for_status()
            xml_data = fetch_response.text
            
            # Parse XML data to extract paper details
            papers = self._parse_pubmed_xml(xml_data)
            
            return papers
            
        except Exception as e:
            logger.error(f"Error fetching paper details: {str(e)}")
            # Return basic info with PMIDs if parsing fails
            return [{"pmid": pmid, "title": "Unknown Title"} for pmid in pmids[:10]]
    
    def _parse_pubmed_xml(self, xml_data: str) -> List[Dict]:
        """
        Parse PubMed XML data to extract paper details.
        
        Args:
            xml_data: XML response from PubMed
            
        Returns:
            List of paper details
        """
        try:
            # Simple parsing - in a real implementation, we would use an XML parser
            # like xml.etree.ElementTree or lxml
            import xml.etree.ElementTree as ET
            
            root = ET.fromstring(xml_data)
            papers = []
            
            # Parse each PubmedArticle
            for article in root.findall(".//PubmedArticle"):
                paper = {}
                
                # Extract PMID
                pmid_elem = article.find(".//PMID")
                if pmid_elem is not None:
                    paper["pmid"] = pmid_elem.text
                
                # Extract title
                title_elem = article.find(".//ArticleTitle")
                if title_elem is not None:
                    paper["title"] = title_elem.text
                else:
                    paper["title"] = "Unknown Title"
                
                # Extract abstract
                abstract_elem = article.find(".//AbstractText")
                if abstract_elem is not None:
                    paper["abstract"] = abstract_elem.text
                
                # Extract authors
                authors = []
                for author_elem in article.findall(".//Author"):
                    last_name = author_elem.find("LastName")
                    first_name = author_elem.find("ForeName")
                    if last_name is not None and first_name is not None:
                        authors.append(f"{first_name.text} {last_name.text}")
                    elif last_name is not None:
                        authors.append(last_name.text)
                
                if authors:
                    paper["authors"] = authors
                
                # Extract journal
                journal_elem = article.find(".//Journal/Title")
                if journal_elem is not None:
                    paper["journal"] = journal_elem.text
                
                # Extract publication date
                pub_date_elem = article.find(".//PubDate/Year")
                if pub_date_elem is not None:
                    paper["year"] = pub_date_elem.text
                
                # Extract DOI
                doi_elem = article.find(".//ArticleId[@IdType='doi']")
                if doi_elem is not None:
                    paper["doi"] = doi_elem.text
                
                papers.append(paper)
            
            return papers
            
        except Exception as e:
            logger.error(f"Error parsing PubMed XML: {str(e)}")
            return []
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

# Example usage:
# async def main():
#     service = PubMedService()
#     try:
#         results = await service.search_papers("machine learning", max_results=10)
#         print(results)
#     finally:
#         await service.close()
#
# if __name__ == "__main__":
#     asyncio.run(main())