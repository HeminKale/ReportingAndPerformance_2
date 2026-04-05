-- Sample seed data for development
-- Note: This assumes you have created auth users manually in Supabase dashboard

-- Insert sample organization
INSERT INTO organizations (id, slug, name, timezone) VALUES
('00000000-0000-0000-0000-000000000001', 'acme-corp', 'Acme Corporation', 'America/New_York');

-- Insert sample users (replace UUIDs with actual auth.users IDs from your Supabase project)
-- You'll need to create these users in Supabase Auth first, then update the IDs here

-- Example structure:
-- INSERT INTO users (id, organization_id, email, full_name, role, manager_id, timezone) VALUES
-- ('user-uuid-from-auth', '00000000-0000-0000-0000-000000000001', 'admin@acme.com', 'Admin User', 'admin', NULL, 'America/New_York'),
-- ('user-uuid-from-auth', '00000000-0000-0000-0000-000000000001', 'manager@acme.com', 'Manager User', 'manager', 'admin-uuid', 'America/New_York'),
-- ('user-uuid-from-auth', '00000000-0000-0000-0000-000000000001', 'employee@acme.com', 'Employee User', 'employee', 'manager-uuid', 'America/New_York');

-- Sample common tasks
-- INSERT INTO tasks (organization_id, title, description, type, assigned_by, is_common_task) VALUES
-- ('00000000-0000-0000-0000-000000000001', 'Daily Standup Update', 'Post your daily standup in Slack', 'daily', 'admin-uuid', TRUE),
-- ('00000000-0000-0000-0000-000000000001', 'Weekly Report', 'Submit weekly progress report', 'weekly', 'admin-uuid', TRUE),
-- ('00000000-0000-0000-0000-000000000001', 'Monthly Review', 'Complete monthly self-review', 'monthly', 'admin-uuid', TRUE);
