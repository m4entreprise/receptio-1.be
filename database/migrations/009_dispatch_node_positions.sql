-- Migration 009: Add node_positions to dispatch_rules
-- Stores positions for all nodes (condition, action, fallback) in a single JSONB field

-- Add node_positions column to dispatch_rules
ALTER TABLE dispatch_rules 
ADD COLUMN IF NOT EXISTS node_positions JSONB DEFAULT '{}'::jsonb;

-- Keep position_x and position_y for backward compatibility but we'll use node_positions going forward
-- node_positions structure:
-- {
--   "condition": {"x": 280, "y": 200},
--   "action": {"x": 280, "y": 380},
--   "fallback": {"x": 550, "y": 380}
-- }

-- Add index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_dispatch_rules_node_positions ON dispatch_rules USING GIN (node_positions);

-- Comment
COMMENT ON COLUMN dispatch_rules.node_positions IS 'JSONB storing positions of all nodes (condition, action, fallback) for visual dispatch builder';
