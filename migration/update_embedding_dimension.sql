-- =====================================================
-- Update Embedding Dimension Migration
-- =====================================================
-- This script updates the vector dimension for embeddings across the database.
-- It is intended to be run when switching to an embedding model with a different dimension.
--
-- !! IMPORTANT !!
-- 1. This is a DESTRUCTIVE operation. All existing embeddings will be lost.
-- 2. You MUST re-crawl or re-process all your knowledge base sources after running this script.
-- 3. Backup your data before running this script.
--
-- How to use:
-- 1. Replace all instances of `__NEW_DIMENSION__` with your desired dimension (e.g., 768 for Google's model).
-- 2. Run this script in your Supabase SQL Editor.
-- 3. Re-crawl all your data.
-- =====================================================

-- Set the new dimension here. For this fix, we are setting it to 768 for Google's model.
-- In a real-world scenario, you would replace __NEW_DIMENSION__ with the desired value.
-- For the purpose of this automated script, we will use 768 directly.

-- =====================================================
-- SECTION 1: ALTER TABLES
-- =====================================================

-- Alter archon_crawled_pages table
ALTER TABLE public.archon_crawled_pages
ALTER COLUMN embedding TYPE vector(768);

-- Alter archon_code_examples table
ALTER TABLE public.archon_code_examples
ALTER COLUMN embedding TYPE vector(768);

-- =====================================================
-- SECTION 2: UPDATE SEARCH FUNCTIONS
-- =====================================================

-- Recreate the function to search for documentation chunks
CREATE OR REPLACE FUNCTION match_archon_crawled_pages (
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10,
  filter JSONB DEFAULT '{}'::jsonb,
  source_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  id BIGINT,
  url VARCHAR,
  chunk_number INTEGER,
  content TEXT,
  metadata JSONB,
  source_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    url,
    chunk_number,
    content,
    metadata,
    source_id,
    1 - (archon_crawled_pages.embedding <=> query_embedding) AS similarity
  FROM archon_crawled_pages
  WHERE metadata @> filter
    AND (source_filter IS NULL OR source_id = source_filter)
  ORDER BY archon_crawled_pages.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Recreate the function to search for code examples
CREATE OR REPLACE FUNCTION match_archon_code_examples (
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10,
  filter JSONB DEFAULT '{}'::jsonb,
  source_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  id BIGINT,
  url VARCHAR,
  chunk_number INTEGER,
  content TEXT,
  summary TEXT,
  metadata JSONB,
  source_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    url,
    chunk_number,
    content,
    summary,
    metadata,
    source_id,
    1 - (archon_code_examples.embedding <=> query_embedding) AS similarity
  FROM archon_code_examples
  WHERE metadata @> filter
    AND (source_filter IS NULL OR source_id = source_filter)
  ORDER BY archon_code_examples.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Recreate the hybrid search function for archon_crawled_pages
CREATE OR REPLACE FUNCTION hybrid_search_archon_crawled_pages(
    query_embedding vector(768),
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    url VARCHAR,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    max_vector_results INT;
    max_text_results INT;
BEGIN
    -- Calculate how many results to fetch from each search type
    max_vector_results := match_count;
    max_text_results := match_count;

    RETURN QUERY
    WITH vector_results AS (
        -- Vector similarity search
        SELECT
            cp.id,
            cp.url,
            cp.chunk_number,
            cp.content,
            cp.metadata,
            cp.source_id,
            1 - (cp.embedding <=> query_embedding) AS vector_sim
        FROM archon_crawled_pages cp
        WHERE cp.metadata @> filter
            AND (source_filter IS NULL OR cp.source_id = source_filter)
            AND cp.embedding IS NOT NULL
        ORDER BY cp.embedding <=> query_embedding
        LIMIT max_vector_results
    ),
    text_results AS (
        -- Full-text search with ranking
        SELECT
            cp.id,
            cp.url,
            cp.chunk_number,
            cp.content,
            cp.metadata,
            cp.source_id,
            ts_rank_cd(cp.content_search_vector, plainto_tsquery('english', query_text)) AS text_sim
        FROM archon_crawled_pages cp
        WHERE cp.metadata @> filter
            AND (source_filter IS NULL OR cp.source_id = source_filter)
            AND cp.content_search_vector @@ plainto_tsquery('english', query_text)
        ORDER BY text_sim DESC
        LIMIT max_text_results
    ),
    combined_results AS (
        -- Combine results from both searches
        SELECT
            COALESCE(v.id, t.id) AS id,
            COALESCE(v.url, t.url) AS url,
            COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
            COALESCE(v.content, t.content) AS content,
            COALESCE(v.metadata, t.metadata) AS metadata,
            COALESCE(v.source_id, t.source_id) AS source_id,
            -- Use vector similarity if available, otherwise text similarity
            COALESCE(v.vector_sim, t.text_sim, 0)::float8 AS similarity,
            -- Determine match type
            CASE
                WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN 'hybrid'
                WHEN v.id IS NOT NULL THEN 'vector'
                ELSE 'keyword'
            END AS match_type
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT * FROM combined_results
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Recreate the hybrid search function for archon_code_examples
CREATE OR REPLACE FUNCTION hybrid_search_archon_code_examples(
    query_embedding vector(768),
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    url VARCHAR,
    chunk_number INTEGER,
    content TEXT,
    summary TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    max_vector_results INT;
    max_text_results INT;
BEGIN
    -- Calculate how many results to fetch from each search type
    max_vector_results := match_count;
    max_text_results := match_count;

    RETURN QUERY
    WITH vector_results AS (
        -- Vector similarity search
        SELECT
            ce.id,
            ce.url,
            ce.chunk_number,
            ce.content,
            ce.summary,
            ce.metadata,
            ce.source_id,
            1 - (ce.embedding <=> query_embedding) AS vector_sim
        FROM archon_code_examples ce
        WHERE ce.metadata @> filter
            AND (source_filter IS NULL OR ce.source_id = source_filter)
            AND ce.embedding IS NOT NULL
        ORDER BY ce.embedding <=> query_embedding
        LIMIT max_vector_results
    ),
    text_results AS (
        -- Full-text search with ranking (searches both content and summary)
        SELECT
            ce.id,
            ce.url,
            ce.chunk_number,
            ce.content,
            ce.summary,
            ce.metadata,
            ce.source_id,
            ts_rank_cd(ce.content_search_vector, plainto_tsquery('english', query_text)) AS text_sim
        FROM archon_code_examples ce
        WHERE ce.metadata @> filter
            AND (source_filter IS NULL OR ce.source_id = source_filter)
            AND ce.content_search_vector @@ plainto_tsquery('english', query_text)
        ORDER BY text_sim DESC
        LIMIT max_text_results
    ),
    combined_results AS (
        -- Combine results from both searches
        SELECT
            COALESCE(v.id, t.id) AS id,
            COALESCE(v.url, t.url) AS url,
            COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
            COALESCE(v.content, t.content) AS content,
            COALESCE(v.summary, t.summary) AS summary,
            COALESCE(v.metadata, t.metadata) AS metadata,
            COALESCE(v.source_id, t.source_id) AS source_id,
            -- Use vector similarity if available, otherwise text similarity
            COALESCE(v.vector_sim, t.text_sim, 0)::float8 AS similarity,
            -- Determine match type
            CASE
                WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN 'hybrid'
                WHEN v.id IS NOT NULL THEN 'vector'
                ELSE 'keyword'
            END AS match_type
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT * FROM combined_results
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The embedding dimension has been updated to 768.
-- You must now re-crawl all your knowledge base sources.
-- =====================================================
