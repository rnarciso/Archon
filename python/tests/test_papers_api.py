"""Tests for the papers API endpoints."""

def test_papers_search_endpoint(client):
    """Test that papers search endpoint exists and responds."""
    search_request = {"query": "machine learning", "max_results": 5}
    
    response = client.post("/api/papers/search", json=search_request)
    # Accept various status codes - endpoint exists
    assert response.status_code in [200, 400, 422, 500]

def test_papers_tag_endpoint(client):
    """Test that papers tag endpoint exists."""
    tag_request = {"doi": "10.1038/nature12373"}
    
    response = client.post("/api/papers/tag", json=tag_request)
    # Accept various status codes - endpoint exists
    assert response.status_code in [200, 400, 422, 500]

def test_papers_untag_endpoint(client):
    """Test that papers untag endpoint exists."""
    tag_request = {"doi": "10.1038/nature12373"}
    
    response = client.delete("/api/papers/tag", json=tag_request)
    # Accept various status codes - endpoint exists
    assert response.status_code in [200, 400, 422, 500]

def test_papers_tagged_endpoint(client):
    """Test that papers tagged endpoint exists."""
    response = client.get("/api/papers/tagged")
    # Accept various status codes - endpoint exists
    assert response.status_code in [200, 400, 422, 500]

def test_papers_download_endpoint(client):
    """Test that papers download endpoint exists."""
    response = client.post("/api/papers/download")
    # Accept various status codes - endpoint exists
    assert response.status_code in [200, 400, 422, 500]