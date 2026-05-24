-- Alerts / Notifications table for brajmarg-admin
-- Run in Supabase SQL Editor. Create storage bucket: brajmarg_alert_images (public)

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id UUID REFERENCES temples(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL DEFAULT 'general'
    CHECK (alert_type IN ('festival', 'special_darshan', 'closure', 'timing_change', 'general')),
  priority TEXT NOT NULL DEFAULT 'info'
    CHECK (priority IN ('info', 'important', 'urgent')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_alerts_temple ON alerts (temple_id);
CREATE INDEX IF NOT EXISTS idx_alerts_schedule ON alerts (starts_at, ends_at);

-- RLS: align with other admin tables (adjust policies to match your project)
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on alerts"
  ON alerts FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on alerts"
  ON alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on alerts"
  ON alerts FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete on alerts"
  ON alerts FOR DELETE
  USING (true);
