ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_resigned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS employee_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  gender TEXT,
  address TEXT,
  salary_bank_account TEXT,
  ifsc_code TEXT,
  emergency_contact TEXT,
  uan_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employee_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee own read/write" ON employee_details;
CREATE POLICY "employee own read/write" ON employee_details
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "manager read team" ON employee_details;
CREATE POLICY "manager read team" ON employee_details
  FOR SELECT
  USING (user_id IN (SELECT id FROM get_all_subordinates(auth.uid())));

DO $$
BEGIN
  CREATE TYPE document_type AS ENUM (
    'resume',
    'aadhar',
    'pan',
    'photo',
    'salary_slip',
    'resignation_letter',
    'full_final_settlement',
    'offer_letter',
    'job_description',
    'training_certificate',
    'salary_statement'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read/write" ON employee_documents;
CREATE POLICY "owner read/write" ON employee_documents
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "manager read team docs" ON employee_documents;
CREATE POLICY "manager read team docs" ON employee_documents
  FOR SELECT
  USING (user_id IN (SELECT id FROM get_all_subordinates(auth.uid())));

DROP POLICY IF EXISTS "manager insert salary statement" ON employee_documents;
CREATE POLICY "manager insert salary statement" ON employee_documents
  FOR INSERT
  WITH CHECK (
    doc_type = 'salary_statement'
    AND user_id IN (SELECT id FROM get_all_subordinates(auth.uid()))
  );

CREATE TABLE IF NOT EXISTS alumni_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  last_working_date DATE,
  resignation_letter_url TEXT,
  settlement_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alumni_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee alumni access" ON alumni_details;
CREATE POLICY "employee alumni access" ON alumni_details
  FOR ALL
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM users
      WHERE id = auth.uid() AND is_resigned = TRUE
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM users
      WHERE id = auth.uid() AND is_resigned = TRUE
    )
  );

DROP POLICY IF EXISTS "manager alumni read" ON alumni_details;
CREATE POLICY "manager alumni read" ON alumni_details
  FOR SELECT
  USING (user_id IN (SELECT id FROM get_all_subordinates(auth.uid())));

CREATE TABLE IF NOT EXISTS salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  fixed_salary NUMERIC(12,2) DEFAULT 0,
  incentive NUMERIC(12,2) DEFAULT 0,
  salary_statement_url TEXT,
  salary_statement_name TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, month)
);

ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee read own salary" ON salary_records;
CREATE POLICY "employee read own salary" ON salary_records
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "manager read/write team salary" ON salary_records;
CREATE POLICY "manager read/write team salary" ON salary_records
  FOR ALL
  USING (user_id IN (SELECT id FROM get_all_subordinates(auth.uid())))
  WITH CHECK (user_id IN (SELECT id FROM get_all_subordinates(auth.uid())));

DO $$
BEGIN
  CREATE TYPE training_status AS ENUM ('not_started', 'in_progress', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_completed DATE,
  status training_status NOT NULL DEFAULT 'not_started',
  certificate_url TEXT,
  certificate_name TEXT,
  assigned_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee read/write own trainings" ON trainings;
CREATE POLICY "employee read/write own trainings" ON trainings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "manager read/assign team trainings" ON trainings;
CREATE POLICY "manager read/assign team trainings" ON trainings
  FOR ALL
  USING (user_id IN (SELECT id FROM get_all_subordinates(auth.uid())))
  WITH CHECK (user_id IN (SELECT id FROM get_all_subordinates(auth.uid())));

DO $$
BEGIN
  CREATE TYPE enquiry_type AS ENUM ('new', 'renewal');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE enquiry_status AS ENUM ('prospecting', 'analyzing', 'closed_won', 'closed_lost');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type enquiry_type NOT NULL DEFAULT 'new',
  name TEXT NOT NULL,
  status enquiry_status NOT NULL DEFAULT 'prospecting',
  reason TEXT,
  iso_standard TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  certification_body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner sees own enquiries" ON enquiries;
CREATE POLICY "owner sees own enquiries" ON enquiries
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "manager sees team enquiries" ON enquiries;
CREATE POLICY "manager sees team enquiries" ON enquiries
  FOR SELECT
  USING (owner_id IN (SELECT id FROM get_all_subordinates(auth.uid())));

DROP POLICY IF EXISTS "manager update team enquiries" ON enquiries;
CREATE POLICY "manager update team enquiries" ON enquiries
  FOR UPDATE
  USING (owner_id IN (SELECT id FROM get_all_subordinates(auth.uid())));

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('employee-documents', 'employee-documents', false),
  ('salary-statements', 'salary-statements', false)
ON CONFLICT (id) DO NOTHING;
