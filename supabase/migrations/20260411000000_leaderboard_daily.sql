-- Daily categorical performance ratings (separate from monthly numeric leaderboard)

CREATE TYPE daily_performance_rating AS ENUM (
    'very_poor',
    'poor',
    'average',
    'good',
    'very_good',
    'excellent'
);

CREATE TABLE leaderboard_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating_date DATE NOT NULL,
    performance daily_performance_rating NOT NULL,
    comments TEXT,
    decided_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id, rating_date)
);

CREATE INDEX idx_leaderboard_daily_org_date ON leaderboard_daily(organization_id, rating_date);

CREATE TRIGGER update_leaderboard_daily_updated_at
    BEFORE UPDATE ON leaderboard_daily
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE leaderboard_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leaderboard_daily in their organization"
    ON leaderboard_daily FOR SELECT
    USING (organization_id = get_user_org());

CREATE POLICY "Managers can create leaderboard_daily entries"
    ON leaderboard_daily FOR INSERT
    WITH CHECK (organization_id = get_user_org() AND is_manager());

CREATE POLICY "Managers can update leaderboard_daily entries"
    ON leaderboard_daily FOR UPDATE
    USING (organization_id = get_user_org() AND is_manager());
