-- Add archived column to archon_projects table
-- This migration adds support for project archiving functionality

-- Add the archived column with a default value of false
ALTER TABLE archon_projects ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add a comment for documentation
COMMENT ON COLUMN archon_projects.archived IS 'Whether the project is archived (hidden from main view)';

-- Create an index on the archived column for better query performance
CREATE INDEX IF NOT EXISTS idx_archon_projects_archived ON archon_projects(archived);

-- Update any existing projects to ensure they have the archived field set correctly
UPDATE archon_projects SET archived = FALSE WHERE archived IS NULL;