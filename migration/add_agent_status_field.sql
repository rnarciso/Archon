-- =====================================================
-- Add Agent Status Field to Tasks Table
-- =====================================================
-- This migration adds an agent_status column to track the execution status
-- of the agent for each task (PENDING, RUNNING, COMPLETED, ERROR)
-- =====================================================

-- Add agent_status column to archon_tasks table
ALTER TABLE archon_tasks 
ADD COLUMN agent_status TEXT DEFAULT 'PENDING' 
CHECK (agent_status IN ('PENDING', 'RUNNING', 'COMPLETED', 'ERROR'));

-- Create index for faster querying by agent status
CREATE INDEX idx_archon_tasks_agent_status ON archon_tasks(agent_status);

-- Add comments to document the new field
COMMENT ON COLUMN archon_tasks.agent_status IS 'Agent execution status: PENDING (waiting to run), RUNNING (currently executing), COMPLETED (finished successfully), ERROR (execution failed)';

-- =====================================================
-- Migration Complete
-- =====================================================