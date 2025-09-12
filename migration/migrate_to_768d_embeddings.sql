-- =====================================================
-- Migrate to 768-Dimension Embeddings
-- =====================================================
-- This script updates the database to use 768-dimension vectors for embeddings.
-- This is required when using models like Google's 'text-embedding-004'.
--
-- !! IMPORTANT !!
-- 1. This is a DESTRUCTIVE operation. All existing embeddings in your database
--    will be deleted.
-- 2. You MUST re-crawl all your knowledge base sources after running this script
--    to regenerate embeddings with the new dimension.
-- 3. It is highly recommended to back up your data before running this script.
--
-- How to use:
-- 1. Connect to your Supabase database.
-- 2. Run this entire script in the Supabase SQL Editor.
-- 3. After the script completes successfully, go back to the Archon application
--    and re-crawl all your data sources from the Knowledge Base page.
-- =====================================================

-- =====================================================
-- SECTION 1: Clear existing data
-- =====================================================

-- Clear all crawled pages and code examples to ensure no old data remains.
-- This is safer than trying to update rows with incorrect dimensions.
TRUNCATE TABLE public.archon_crawled_pages RESTART IDENTITY;
TRUNCATE TABLE public.archon_code_examples RESTART IDENTITY;

-- =====================================================
-- SECTION 2: ALTER TABLES
-- =====================================================

-- Alter archon_crawled_pages table to use 768-dimension vectors
ALTER TABLE public.archon_crawled_pages
ALTER COLUMN embedding TYPE vector(768);

-- Alter archon_code_examples table to use 768-dimension vectors
ALTER TABLE public.archon_code_examples
ALTER COLUMN embedding TYPE vector(768);

-- =====================================================
-- SECTION 3: UPDATE SEARCH FUNCTIONS
-- =====================================================

-- Recreate the function to search for documentation chunks with the new dimension
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
    acp.id,
    acp.url,
    acp.chunk_number,
    acp.content,
    acp.metadata,
    acp.source_id,
    1 - (acp.embedding <=> query_embedding) AS similarity
  FROM archon_crawled_pages acp
  WHERE acp.metadata @> filter
    AND (source_filter IS NULL OR acp.source_id = source_filter)
  ORDER BY acp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Recreate the function to search for code examples with the new dimension
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
    ace.id,
    ace.url,
    ace.chunk_number,
    ace.content,
    ace.summary,
    ace.metadata,
    ace.source_id,
    1 - (ace.embedding <=> query_embedding) AS similarity
  FROM archon_code_examples ace
  WHERE ace.metadata @> filter
    AND (source_filter IS NULL OR ace.source_id = source_filter)
  ORDER BY ace.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Recreate the hybrid search function for archon_crawled_pages with the new dimension
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
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            cp.id, 1 - (cp.embedding <=> query_embedding) AS vector_sim
        FROM archon_crawled_pages cp
        WHERE cp.metadata @> filter
            AND (source_filter IS NULL OR cp.source_id = source_filter)
            AND cp.embedding IS NOT NULL
        ORDER BY cp.embedding <=> query_embedding
        LIMIT match_count
    ),
    text_results AS (
        SELECT
            cp.id, ts_rank_cd(cp.content_search_vector, plainto_tsquery('english', query_text)) AS text_sim
        FROM archon_crawled_pages cp
        WHERE cp.metadata @> filter
            AND (source_filter IS NULL OR cp.source_id = source_filter)
            AND cp.content_search_vector @@ plainto_tsquery('english', query_text)
        ORDER BY text_sim DESC
        LIMIT match_count
    ),
    combined_results AS (
        SELECT
            COALESCE(v.id, t.id) as result_id,
            COALESCE(v.vector_sim, 0) + COALESCE(t.text_sim, 0) as total_score,
            CASE
                WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN 'hybrid'
                WHEN v.id IS NOT NULL THEN 'vector'
                ELSE 'keyword'
            END AS match_type
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT
        p.id, p.url, p.chunk_number, p.content, p.metadata, p.source_id,
        cr.total_score as similarity,
        cr.match_type
    FROM combined_results cr
    JOIN archon_crawled_pages p ON cr.result_id = p.id
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Recreate the hybrid search function for archon_code_examples with the new dimension
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
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            ce.id, 1 - (ce.embedding <=> query_embedding) AS vector_sim
        FROM archon_code_examples ce
        WHERE ce.metadata @> filter
            AND (source_filter IS NULL OR ce.source_id = source_filter)
            AND ce.embedding IS NOT NULL
        ORDER BY ce.embedding <=> query_embedding
        LIMIT match_count
    ),
    text_results AS (
        SELECT
            ce.id, ts_rank_cd(ce.content_search_vector, plainto_tsquery('english', query_text)) AS text_sim
        FROM archon_code_examples ce
        WHERE ce.metadata @> filter
            AND (source_filter IS NULL OR ce.source_id = source_filter)
            AND ce.content_search_vector @@ plainto_tsquery('english', query_text)
        ORDER BY text_sim DESC
        LIMIT match_count
    ),
    combined_results AS (
        SELECT
            COALESCE(v.id, t.id) as result_id,
            COALESCE(v.vector_sim, 0) + COALESCE(t.text_sim, 0) as total_score,
            CASE
                WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN 'hybrid'
                WHEN v.id IS NOT NULL THEN 'vector'
                ELSE 'keyword'
            END AS match_type
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT
        p.id, p.url, p.chunk_number, p.content, p.summary, p.metadata, p.source_id,
        cr.total_score as similarity,
        cr.match_type
    FROM combined_results cr
    JOIN archon_code_examples p ON cr.result_id = p.id
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;


-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The embedding dimension has been successfully updated to 768.
-- You must now go to the Archon Knowledge Base and re-crawl all your sources
-- to populate the database with new embeddings.
-- =====================================================
