-- Allow employees to create personal (non–common) tasks assigned to themselves.
-- The UI (task-assignment panel) already sets assigned_to = current user for non-managers;
-- the previous RLS only allowed managers/admins to INSERT, which caused 42501 for self-tasks.

CREATE POLICY "Users can create self-assigned personal tasks"
    ON tasks FOR INSERT
    WITH CHECK (
        organization_id = get_user_org()
        AND is_common_task = FALSE
        AND assigned_to = auth.uid()
    );

-- Same scope for edit/delete from the task panel (otherwise create works but update/delete fail).
CREATE POLICY "Users can update own self-assigned personal tasks"
    ON tasks FOR UPDATE
    USING (
        organization_id = get_user_org()
        AND is_common_task = FALSE
        AND assigned_to = auth.uid()
    )
    WITH CHECK (
        organization_id = get_user_org()
        AND is_common_task = FALSE
        AND assigned_to = auth.uid()
    );

CREATE POLICY "Users can delete own self-assigned personal tasks"
    ON tasks FOR DELETE
    USING (
        organization_id = get_user_org()
        AND is_common_task = FALSE
        AND assigned_to = auth.uid()
    );
