# Paper Search and Download Feature Implementation

## Task Overview
This document summarizes the implementation of the "Implement Search for Papers" task for the SciHub To PDF project.

## Feature Description
The implemented feature allows users to:
1. Search for scientific papers on PubMed using keywords
2. Tag papers they want to download
3. Extract DOI addresses from tagged papers
4. Retrieve all tagged papers from Sci-Hub using their DOI codes

## Implementation Summary

### New Services Created
1. **PubMedService** (`/projects/Archon/python/src/server/services/papers/pubmed_service.py`)
   - Searches papers on PubMed using the Entrez Utilities API
   - Parses paper metadata including title, authors, abstract, and DOI
   - Handles pagination for search results

2. **SciHubService** (`/projects/Archon/python/src/server/services/papers/scihub_service.py`)
   - Downloads papers from Sci-Hub using DOIs
   - Handles multiple Sci-Hub domains
   - Manages user agents to avoid blocking
   - Saves downloaded papers to local storage

3. **PaperService** (`/projects/Archon/python/src/server/services/papers/paper_service.py`)
   - Integrates PubMed and Sci-Hub services
   - Manages paper tagging functionality
   - Coordinates paper downloads

### API Endpoints Created
1. `POST /api/papers/search` - Search for papers on PubMed
2. `POST /api/papers/tag` - Tag a paper for download
3. `DELETE /api/papers/tag` - Remove a paper from the tagged list
4. `GET /api/papers/tagged` - Get list of tagged paper DOIs
5. `POST /api/papers/download` - Download all tagged papers from Sci-Hub

### Integration with Existing System
- Added papers API router to main application (`/projects/Archon/python/src/server/main.py`)
- Added proper cleanup functions for service shutdown
- Created basic API tests (`/projects/Archon/python/tests/test_papers_api.py`)
- Followed existing code patterns and structure

## Technical Details

### Dependencies Used
- `httpx` - For making HTTP requests to PubMed and Sci-Hub
- `beautifulsoup4` - For parsing HTML content from Sci-Hub
- `xml.etree.ElementTree` - For parsing PubMed XML responses

### Key Features
- Asynchronous operations for better performance
- Error handling with proper logging
- Background processing for paper downloads
- DOI validation and management
- Support for multiple Sci-Hub domains

## File Structure
```
/projects/Archon/python/src/server/
├── services/
│   └── papers/
│       ├── __init__.py
│       ├── pubmed_service.py
│       ├── scihub_service.py
│       ├── paper_service.py
│       └── README.md
└── api_routes/
    └── papers_api.py

/projects/Archon/python/tests/
└── test_papers_api.py
```

## Usage Instructions

### Searching for Papers
Send a POST request to `/api/papers/search` with a JSON body containing:
```json
{
  "query": "machine learning",
  "max_results": 20,
  "start": 0
}
```

### Tagging Papers
Send a POST request to `/api/papers/tag` with a JSON body containing:
```json
{
  "doi": "10.1038/nature12373"
}
```

### Downloading Papers
Send a POST request to `/api/papers/download` to start downloading all tagged papers.

## Testing
Basic API tests have been created in `/projects/Archon/python/tests/test_papers_api.py` to verify that all endpoints exist and respond correctly.

## Future Improvements
1. Add more comprehensive error handling for edge cases
2. Implement download progress tracking
3. Add support for other academic databases
4. Implement more sophisticated paper metadata parsing
5. Add rate limiting for API calls to respect service limits