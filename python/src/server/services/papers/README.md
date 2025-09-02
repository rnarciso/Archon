# Paper Search and Download Feature

## Overview
This feature allows users to search for scientific papers on PubMed, tag papers they want to download, and retrieve them from Sci-Hub using their DOI codes.

## Features
- 🔍 **Search Papers**: Search scientific papers on PubMed using keywords
- 🏷️ **Tag Papers**: Mark papers for download using their DOI codes
- 📥 **Download Papers**: Download tagged papers from Sci-Hub automatically
- 🔄 **Background Processing**: Download papers in the background to avoid blocking the UI
- 📊 **Pagination**: Support for paginated results when searching papers
- 💾 **Persistent Storage**: Paper tags are maintained during the application runtime

## API Endpoints

### Search Papers
```
POST /api/papers/search
```
Search for papers on PubMed.

**Request Body:**
```json
{
  "query": "string",        // Search query
  "max_results": 20,        // Maximum number of results (optional, default: 20)
  "start": 0                // Starting index for pagination (optional, default: 0)
}
```

**Response:**
```json
{
  "query": "string",        // Search query
  "total_results": 0,       // Total number of results
  "papers": []              // List of papers with metadata
}
```

### Tag Paper
```
POST /api/papers/tag
```
Tag a paper for download.

**Request Body:**
```json
{
  "doi": "string"           // DOI of the paper to tag
}
```

**Response:**
```json
{
  "message": "string"       // Success message
}
```

### Untag Paper
```
DELETE /api/papers/tag
```
Remove a paper from the tagged list.

**Request Body:**
```json
{
  "doi": "string"           // DOI of the paper to untag
}
```

**Response:**
```json
{
  "message": "string"       // Success message
}
```

### Get Tagged Papers
```
GET /api/papers/tagged
```
Get list of tagged paper DOIs.

**Response:**
```json
{
  "tagged_papers": [],      // List of tagged paper DOIs
  "count": 0                // Number of tagged papers
}
```

### Download Tagged Papers
```
POST /api/papers/download
```
Download all tagged papers from Sci-Hub.

**Response:**
```json
{
  "message": "string",      // Success message
  "tagged_count": 0         // Number of papers being downloaded
}
```

## Implementation Details

### Services
1. **PubMedService** - Handles searching for papers on PubMed
2. **SciHubService** - Handles downloading papers from Sci-Hub
3. **PaperService** - Main service that integrates both services

### Key Features
- Search papers on PubMed with keyword queries
- Tag papers for download using their DOIs
- Download tagged papers from Sci-Hub in the background
- Extract paper metadata including title, authors, abstract, and DOI
- Handle errors gracefully with proper logging

## Dependencies
- `httpx` - For making HTTP requests
- `beautifulsoup4` - For parsing HTML content from Sci-Hub
- `xml.etree.ElementTree` - For parsing PubMed XML responses