-- salary-statements bucket: manager upload path is salary-statements/{team_member_id}/...
-- (see components/manager/manager-salary-tab.tsx). Without policies, those uploads 403.
-- Employees need SELECT on their own objects for signed URLs to work on the Documents tab.

CREATE POLICY "Managers manage salary-statement files for their team"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'salary-statements'
        AND is_manager()
        AND (
            (split_part(name, '/', 2))::uuid IN (SELECT id FROM get_all_subordinates(auth.uid()))
            OR split_part(name, '/', 2) = (SELECT auth.uid()::text)
        )
    )
    WITH CHECK (
        bucket_id = 'salary-statements'
        AND is_manager()
        AND (
            (split_part(name, '/', 2))::uuid IN (SELECT id FROM get_all_subordinates(auth.uid()))
            OR split_part(name, '/', 2) = (SELECT auth.uid()::text)
        )
    );

CREATE POLICY "Users can read own salary statement files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'salary-statements'
        AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
    );
