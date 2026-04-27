-- The employee-documents bucket is created in 20260425180000 but no storage.objects RLS
-- policies were added, so .storage.from('employee-documents').upload() fails with 403:
-- "new row violates row-level security policy" on storage.objects.
-- Object keys are: {doc_type}/{user_id}/...  (see components/tasks/documents-tab.tsx)

CREATE POLICY "Users manage own path in employee-documents"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'employee-documents'
        AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
    )
    WITH CHECK (
        bucket_id = 'employee-documents'
        AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
    );
