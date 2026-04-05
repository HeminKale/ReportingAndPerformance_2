-- Helper function to get current user's organization
CREATE OR REPLACE FUNCTION get_user_org()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT organization_id FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (SELECT role FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role = 'admin' FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is manager
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role IN ('admin', 'manager') FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recursive function to get all team members under a manager
CREATE OR REPLACE FUNCTION get_team_members(manager_uuid UUID)
RETURNS TABLE(id UUID) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE team AS (
        -- Base case: direct reports
        SELECT u.id
        FROM users u
        WHERE u.manager_id = manager_uuid
        
        UNION
        
        -- Recursive case: reports of reports
        SELECT u.id
        FROM users u
        INNER JOIN team t ON u.manager_id = t.id
    )
    SELECT team.id FROM team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Users can view their own organization"
    ON organizations FOR SELECT
    USING (id = get_user_org());

CREATE POLICY "Admins can update their organization"
    ON organizations FOR UPDATE
    USING (id = get_user_org() AND is_admin());

-- Users policies
CREATE POLICY "Users can view users in their organization"
    ON users FOR SELECT
    USING (organization_id = get_user_org());

CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Admins can insert users in their organization"
    ON users FOR INSERT
    WITH CHECK (organization_id = get_user_org() AND is_admin());

CREATE POLICY "Admins can update users in their organization"
    ON users FOR UPDATE
    USING (organization_id = get_user_org() AND is_admin());

CREATE POLICY "Admins can delete users in their organization"
    ON users FOR DELETE
    USING (organization_id = get_user_org() AND is_admin());

-- Tasks policies
CREATE POLICY "Users can view tasks in their organization"
    ON tasks FOR SELECT
    USING (
        organization_id = get_user_org() AND
        (is_common_task = TRUE OR assigned_to = auth.uid() OR assigned_to IS NULL)
    );

CREATE POLICY "Managers can view all tasks in their organization"
    ON tasks FOR SELECT
    USING (organization_id = get_user_org() AND is_manager());

CREATE POLICY "Managers can create tasks"
    ON tasks FOR INSERT
    WITH CHECK (organization_id = get_user_org() AND is_manager());

CREATE POLICY "Managers can update tasks"
    ON tasks FOR UPDATE
    USING (organization_id = get_user_org() AND is_manager());

CREATE POLICY "Managers can delete tasks"
    ON tasks FOR DELETE
    USING (organization_id = get_user_org() AND is_manager());

-- Task logs policies
CREATE POLICY "Users can view their own task logs"
    ON task_logs FOR SELECT
    USING (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "Managers can view team task logs"
    ON task_logs FOR SELECT
    USING (
        organization_id = get_user_org() AND 
        is_manager() AND
        user_id IN (SELECT id FROM get_team_members(auth.uid()))
    );

CREATE POLICY "Users can create their own task logs"
    ON task_logs FOR INSERT
    WITH CHECK (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "Users can update their own unverified task logs"
    ON task_logs FOR UPDATE
    USING (
        organization_id = get_user_org() AND 
        user_id = auth.uid() AND 
        verification_status = 'pending'
    );

CREATE POLICY "Managers can update team task logs for verification"
    ON task_logs FOR UPDATE
    USING (
        organization_id = get_user_org() AND 
        is_manager() AND
        user_id IN (SELECT id FROM get_team_members(auth.uid()))
    );

-- Attendance policies
CREATE POLICY "Users can view their own attendance"
    ON attendance FOR SELECT
    USING (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "Managers can view team attendance"
    ON attendance FOR SELECT
    USING (
        organization_id = get_user_org() AND 
        is_manager() AND
        user_id IN (SELECT id FROM get_team_members(auth.uid()))
    );

CREATE POLICY "Users can create their own attendance"
    ON attendance FOR INSERT
    WITH CHECK (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "Users can update their own attendance"
    ON attendance FOR UPDATE
    USING (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "Managers can update team attendance for approval"
    ON attendance FOR UPDATE
    USING (
        organization_id = get_user_org() AND 
        is_manager() AND
        user_id IN (SELECT id FROM get_team_members(auth.uid()))
    );

-- Leaves policies
CREATE POLICY "Users can view their own leaves"
    ON leaves FOR SELECT
    USING (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "Managers can view team leaves"
    ON leaves FOR SELECT
    USING (
        organization_id = get_user_org() AND 
        is_manager() AND
        user_id IN (SELECT id FROM get_team_members(auth.uid()))
    );

CREATE POLICY "Users can create their own leave requests"
    ON leaves FOR INSERT
    WITH CHECK (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "Users can update their own pending leaves"
    ON leaves FOR UPDATE
    USING (
        organization_id = get_user_org() AND 
        user_id = auth.uid() AND 
        status = 'pending'
    );

CREATE POLICY "Managers can update team leaves for approval"
    ON leaves FOR UPDATE
    USING (
        organization_id = get_user_org() AND 
        is_manager() AND
        user_id IN (SELECT id FROM get_team_members(auth.uid()))
    );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (organization_id = get_user_org());

-- Leaderboard policies
CREATE POLICY "Users can view leaderboard in their organization"
    ON leaderboard FOR SELECT
    USING (organization_id = get_user_org());

CREATE POLICY "Managers can create leaderboard entries"
    ON leaderboard FOR INSERT
    WITH CHECK (organization_id = get_user_org() AND is_manager());

CREATE POLICY "Managers can update leaderboard entries"
    ON leaderboard FOR UPDATE
    USING (organization_id = get_user_org() AND is_manager());

-- Mistakes policies
CREATE POLICY "Users can view their own mistakes"
    ON mistakes FOR SELECT
    USING (organization_id = get_user_org() AND user_id = auth.uid());

CREATE POLICY "Managers can view team mistakes"
    ON mistakes FOR SELECT
    USING (
        organization_id = get_user_org() AND 
        is_manager() AND
        user_id IN (SELECT id FROM get_team_members(auth.uid()))
    );

CREATE POLICY "Managers can create mistakes"
    ON mistakes FOR INSERT
    WITH CHECK (organization_id = get_user_org() AND is_manager());

CREATE POLICY "Managers can update mistakes they created"
    ON mistakes FOR UPDATE
    USING (organization_id = get_user_org() AND added_by = auth.uid());

CREATE POLICY "Managers can delete mistakes they created"
    ON mistakes FOR DELETE
    USING (organization_id = get_user_org() AND added_by = auth.uid());

-- Audit logs policies
CREATE POLICY "Admins can view audit logs in their organization"
    ON audit_logs FOR SELECT
    USING (organization_id = get_user_org() AND is_admin());

CREATE POLICY "System can create audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (organization_id = get_user_org());
