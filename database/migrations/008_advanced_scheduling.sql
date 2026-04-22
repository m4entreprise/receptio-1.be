-- Migration 008: Advanced scheduling for staff and groups
-- Adds individual staff availability, per-group custom schedules, and exceptions

-- ============================================================================
-- 1. Staff individual availability (base schedule for each staff member)
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Weekly schedule (can be null if staff uses company default)
    schedule JSONB,
    
    -- Timezone for this staff member (e.g., 'Europe/Brussels')
    timezone VARCHAR(100) DEFAULT 'Europe/Brussels',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_id ON staff_availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_company_id ON staff_availability(company_id);

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_staff_availability_updated_at'
          AND tgrelid = 'staff_availability'::regclass
    ) THEN
        CREATE TRIGGER update_staff_availability_updated_at 
        BEFORE UPDATE ON staff_availability
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- 2. Add custom schedule override to staff_group_members
--    This allows a staff member to have different hours per group
-- ============================================================================
ALTER TABLE staff_group_members 
ADD COLUMN IF NOT EXISTS custom_schedule JSONB,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN staff_group_members.custom_schedule IS 'Override schedule for this staff member in this specific group (same format as staff_groups.schedule)';
COMMENT ON COLUMN staff_group_members.priority IS 'Priority/order of this member within the group for sequential dispatch';

-- Trigger for updated_at on staff_group_members
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_staff_group_members_updated_at'
          AND tgrelid = 'staff_group_members'::regclass
    ) THEN
        CREATE TRIGGER update_staff_group_members_updated_at 
        BEFORE UPDATE ON staff_group_members
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- 3. Staff schedule exceptions (holidays, absences, special hours)
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_schedule_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Exception type: 'absence', 'holiday', 'custom_hours', 'available'
    exception_type VARCHAR(50) NOT NULL DEFAULT 'absence',
    
    -- Date range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Optional: custom hours for 'custom_hours' type (format: {"open": "09:00", "close": "17:00"})
    custom_hours JSONB,
    
    -- Optional: reason/note
    reason TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_schedule_exceptions_staff_id ON staff_schedule_exceptions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedule_exceptions_company_id ON staff_schedule_exceptions(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedule_exceptions_dates ON staff_schedule_exceptions(start_date, end_date);

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_staff_schedule_exceptions_updated_at'
          AND tgrelid = 'staff_schedule_exceptions'::regclass
    ) THEN
        CREATE TRIGGER update_staff_schedule_exceptions_updated_at 
        BEFORE UPDATE ON staff_schedule_exceptions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- 4. Add metadata to staff_groups for better dispatch visualization
-- ============================================================================
ALTER TABLE staff_groups 
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#344453',
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'users';

COMMENT ON COLUMN staff_groups.color IS 'Hex color for visual dispatch builder (e.g., #C7601D)';
COMMENT ON COLUMN staff_groups.icon IS 'Icon identifier for visual dispatch builder';

-- ============================================================================
-- 5. Add visual metadata to dispatch_rules for flow builder
-- ============================================================================
ALTER TABLE dispatch_rules 
ADD COLUMN IF NOT EXISTS position_x INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS position_y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#344453';

COMMENT ON COLUMN dispatch_rules.position_x IS 'X position in visual flow builder canvas';
COMMENT ON COLUMN dispatch_rules.position_y IS 'Y position in visual flow builder canvas';
COMMENT ON COLUMN dispatch_rules.color IS 'Color for this rule node in visual builder';
