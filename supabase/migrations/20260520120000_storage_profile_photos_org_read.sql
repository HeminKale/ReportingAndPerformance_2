-- Allow org members to view colleague profile photos on leaderboard (read-only).
-- Upload/delete remains restricted to profile-photos/{own_user_id}/ via existing policy.

CREATE POLICY "Org members read colleague profile photos"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'employee-documents'
        AND split_part(name, '/', 1) = 'profile-photos'
        AND EXISTS (
            SELECT 1
            FROM users viewer
            JOIN users owner ON owner.id::text = split_part(name, '/', 2)
            WHERE viewer.id = auth.uid()
              AND viewer.organization_id = owner.organization_id
        )
    );
