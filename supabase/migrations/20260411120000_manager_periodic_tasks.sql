-- Periodic task templates for managers (materialized into tasks by cron)

CREATE TABLE manager_periodic_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type task_type NOT NULL,
    day_of_week INTEGER CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
    monthly_day INTEGER CHECK (monthly_day IS NULL OR (monthly_day >= 1 AND monthly_day <= 31)),
    is_numeric_task BOOLEAN NOT NULL DEFAULT FALSE,
    numeric_unit TEXT,
    linked_monthly_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_manager_periodic_tasks_org_manager ON manager_periodic_tasks(organization_id, manager_id);
CREATE INDEX idx_manager_periodic_tasks_enabled ON manager_periodic_tasks(is_enabled) WHERE is_enabled = TRUE;

CREATE TRIGGER update_manager_periodic_tasks_updated_at
    BEFORE UPDATE ON manager_periodic_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE manager_periodic_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view own periodic tasks"
    ON manager_periodic_tasks FOR SELECT
    USING (
        organization_id = get_user_org()
        AND is_manager()
        AND manager_id = auth.uid()
    );

CREATE POLICY "Managers can insert own periodic tasks"
    ON manager_periodic_tasks FOR INSERT
    WITH CHECK (
        organization_id = get_user_org()
        AND is_manager()
        AND manager_id = auth.uid()
    );

CREATE POLICY "Managers can update own periodic tasks"
    ON manager_periodic_tasks FOR UPDATE
    USING (
        organization_id = get_user_org()
        AND is_manager()
        AND manager_id = auth.uid()
    );

CREATE POLICY "Managers can delete own periodic tasks"
    ON manager_periodic_tasks FOR DELETE
    USING (
        organization_id = get_user_org()
        AND is_manager()
        AND manager_id = auth.uid()
    );

-- Idempotency log; only service role writes (no policies for authenticated users)
CREATE TABLE manager_periodic_dispatches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_periodic_task_id UUID NOT NULL REFERENCES manager_periodic_tasks(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (manager_periodic_task_id, period_key)
);

CREATE INDEX idx_manager_periodic_dispatches_task ON manager_periodic_dispatches(manager_periodic_task_id);

ALTER TABLE manager_periodic_dispatches ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies: authenticated role cannot read/write; service role bypasses RLS.
