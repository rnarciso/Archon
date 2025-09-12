-- =====================================================
-- Add Crawl Retry Count Setting
-- =====================================================
-- This migration adds the CRAWL_RETRY_COUNT setting to the archon_settings table.
-- This allows users to configure the number of retry attempts for failed URLs during a crawl.
-- =====================================================

INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('CRAWL_RETRY_COUNT', '3', false, 'rag_strategy', 'Number of times to retry a failed URL during crawl (0-5)')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
