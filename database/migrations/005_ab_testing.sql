-- A/B Testing Tables
-- Migration: 005_ab_testing.sql

-- Table for A/B tests
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  hypothesis TEXT,
  test_type TEXT NOT NULL CHECK (test_type IN ('subject_line', 'content', 'send_time', 'from_name')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),

  -- Configuration
  confidence_level INTEGER NOT NULL DEFAULT 95 CHECK (confidence_level BETWEEN 80 AND 99),
  minimum_sample_size INTEGER NOT NULL DEFAULT 1000,
  test_duration_days INTEGER NOT NULL DEFAULT 7 CHECK (test_duration_days BETWEEN 1 AND 30),

  -- Timing
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,

  -- Audience
  total_audience_size INTEGER NOT NULL DEFAULT 0,
  segment_id UUID, -- Reference will be added in migration 006

  -- Results
  control_variant_id UUID,
  winner_variant_id UUID,

  -- Statistical significance
  statistical_significance JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT ab_tests_dates_check CHECK (end_date IS NULL OR end_date > start_date),
  CONSTRAINT ab_tests_workspace_name_unique UNIQUE (workspace_id, name)
);

-- Table for A/B test variants
CREATE TABLE IF NOT EXISTS ab_test_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  traffic_allocation INTEGER NOT NULL DEFAULT 50 CHECK (traffic_allocation BETWEEN 1 AND 100),

  -- Metrics
  recipients INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  clicked INTEGER NOT NULL DEFAULT 0,
  unsubscribed INTEGER NOT NULL DEFAULT 0,
  bounced INTEGER NOT NULL DEFAULT 0,
  complained INTEGER NOT NULL DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,

  -- Calculated rates (stored for performance)
  delivery_rate DECIMAL(5,4) DEFAULT 0,
  open_rate DECIMAL(5,4) DEFAULT 0,
  click_rate DECIMAL(5,4) DEFAULT 0,
  unsubscribe_rate DECIMAL(5,4) DEFAULT 0,
  conversion_rate DECIMAL(5,4) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT ab_test_variants_test_name_unique UNIQUE (ab_test_id, name),
  CONSTRAINT ab_test_variants_metrics_check CHECK (
    sent >= delivered AND
    delivered >= opened AND
    opened >= clicked AND
    recipients >= sent
  )
);

-- Table for A/B test participant assignments
CREATE TABLE IF NOT EXISTS ab_test_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES ab_test_variants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Engagement tracking
  email_sent_at TIMESTAMPTZ,
  email_delivered_at TIMESTAMPTZ,
  email_opened_at TIMESTAMPTZ,
  email_clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,

  -- Metadata
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT ab_test_participants_unique UNIQUE (ab_test_id, lead_id),
  CONSTRAINT ab_test_participants_timeline_check CHECK (
    email_delivered_at IS NULL OR email_delivered_at >= email_sent_at
  )
);

-- Table for A/B test campaigns (link tests to actual campaigns)
CREATE TABLE IF NOT EXISTS ab_test_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES ab_test_variants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ab_test_campaigns_unique UNIQUE (ab_test_id, variant_id, campaign_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ab_tests_workspace_id ON ab_tests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_test_type ON ab_tests(test_type);
CREATE INDEX IF NOT EXISTS idx_ab_tests_created_at ON ab_tests(created_at);

CREATE INDEX IF NOT EXISTS idx_ab_test_variants_ab_test_id ON ab_test_variants(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_variants_metrics ON ab_test_variants(recipients, opened, clicked);

CREATE INDEX IF NOT EXISTS idx_ab_test_participants_ab_test_id ON ab_test_participants(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_participants_variant_id ON ab_test_participants(variant_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_participants_lead_id ON ab_test_participants(lead_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_participants_engagement ON ab_test_participants(email_opened_at, email_clicked_at);

CREATE INDEX IF NOT EXISTS idx_ab_test_campaigns_ab_test_id ON ab_test_campaigns(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_campaigns_campaign_id ON ab_test_campaigns(campaign_id);

-- Functions for automatic rate calculations
CREATE OR REPLACE FUNCTION update_ab_test_variant_rates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.delivery_rate = CASE
    WHEN NEW.sent > 0 THEN NEW.delivered::DECIMAL / NEW.sent
    ELSE 0
  END;

  NEW.open_rate = CASE
    WHEN NEW.delivered > 0 THEN NEW.opened::DECIMAL / NEW.delivered
    ELSE 0
  END;

  NEW.click_rate = CASE
    WHEN NEW.opened > 0 THEN NEW.clicked::DECIMAL / NEW.opened
    ELSE 0
  END;

  NEW.unsubscribe_rate = CASE
    WHEN NEW.delivered > 0 THEN NEW.unsubscribed::DECIMAL / NEW.delivered
    ELSE 0
  END;

  NEW.conversion_rate = CASE
    WHEN NEW.delivered > 0 THEN NEW.clicked::DECIMAL / NEW.delivered
    ELSE 0
  END;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update rates
CREATE TRIGGER trigger_update_ab_test_variant_rates
  BEFORE UPDATE ON ab_test_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_ab_test_variant_rates();

-- Function to update ab_test updated_at when variants change
CREATE OR REPLACE FUNCTION update_ab_test_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ab_tests
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.ab_test_id, OLD.ab_test_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update parent test timestamp
CREATE TRIGGER trigger_update_ab_test_timestamp
  AFTER INSERT OR UPDATE OR DELETE ON ab_test_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_ab_test_timestamp();

-- Views for easy querying

-- View for test summaries with aggregated metrics
CREATE OR REPLACE VIEW ab_test_summaries AS
SELECT
  t.id,
  t.workspace_id,
  t.name,
  t.description,
  t.test_type,
  t.status,
  t.confidence_level,
  t.start_date,
  t.end_date,
  t.winner_variant_id,
  t.created_at,
  t.updated_at,

  -- Aggregated metrics
  COUNT(v.id) as variant_count,
  SUM(v.recipients) as total_recipients,
  SUM(v.sent) as total_sent,
  SUM(v.delivered) as total_delivered,
  SUM(v.opened) as total_opened,
  SUM(v.clicked) as total_clicked,

  -- Overall rates
  CASE
    WHEN SUM(v.sent) > 0 THEN SUM(v.delivered)::DECIMAL / SUM(v.sent)
    ELSE 0
  END as overall_delivery_rate,

  CASE
    WHEN SUM(v.delivered) > 0 THEN SUM(v.opened)::DECIMAL / SUM(v.delivered)
    ELSE 0
  END as overall_open_rate,

  CASE
    WHEN SUM(v.opened) > 0 THEN SUM(v.clicked)::DECIMAL / SUM(v.opened)
    ELSE 0
  END as overall_click_rate

FROM ab_tests t
LEFT JOIN ab_test_variants v ON t.id = v.ab_test_id
GROUP BY t.id, t.workspace_id, t.name, t.description, t.test_type, t.status,
         t.confidence_level, t.start_date, t.end_date, t.winner_variant_id,
         t.created_at, t.updated_at;

-- RLS Policies
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_campaigns ENABLE ROW LEVEL SECURITY;

-- Policies for ab_tests
CREATE POLICY "Users can view ab_tests from their workspace" ON ab_tests
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can create ab_tests in their workspace" ON ab_tests
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can update ab_tests in their workspace" ON ab_tests
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can delete ab_tests in their workspace" ON ab_tests
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Policies for ab_test_variants
CREATE POLICY "Users can view ab_test_variants from their workspace" ON ab_test_variants
  FOR SELECT USING (
    ab_test_id IN (
      SELECT id FROM ab_tests WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can create ab_test_variants in their workspace" ON ab_test_variants
  FOR INSERT WITH CHECK (
    ab_test_id IN (
      SELECT id FROM ab_tests WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can update ab_test_variants in their workspace" ON ab_test_variants
  FOR UPDATE USING (
    ab_test_id IN (
      SELECT id FROM ab_tests WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can delete ab_test_variants in their workspace" ON ab_test_variants
  FOR DELETE USING (
    ab_test_id IN (
      SELECT id FROM ab_tests WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Policies for ab_test_participants
CREATE POLICY "Users can view ab_test_participants from their workspace" ON ab_test_participants
  FOR SELECT USING (
    ab_test_id IN (
      SELECT id FROM ab_tests WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can create ab_test_participants in their workspace" ON ab_test_participants
  FOR INSERT WITH CHECK (
    ab_test_id IN (
      SELECT id FROM ab_tests WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can update ab_test_participants in their workspace" ON ab_test_participants
  FOR UPDATE USING (
    ab_test_id IN (
      SELECT id FROM ab_tests WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Policies for ab_test_campaigns
CREATE POLICY "Users can view ab_test_campaigns from their workspace" ON ab_test_campaigns
  FOR SELECT USING (
    ab_test_id IN (
      SELECT id FROM ab_tests WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can create ab_test_campaigns in their workspace" ON ab_test_campaigns
  FOR INSERT WITH CHECK (
    ab_test_id IN (
      SELECT id FROM ab_tests WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Grant permissions
GRANT ALL ON ab_tests TO authenticated;
GRANT ALL ON ab_test_variants TO authenticated;
GRANT ALL ON ab_test_participants TO authenticated;
GRANT ALL ON ab_test_campaigns TO authenticated;
GRANT SELECT ON ab_test_summaries TO authenticated;
