-- Migration 002: Campaign improvements
-- - Multi-template support per campaign
-- - Campaign scheduling (scheduled_at)
-- - Configurable message interval (anti-ban)
-- - Contact invalid status

-- ─── campaign_templates (N:N entre campaigns e templates) ────────────────────
CREATE TABLE IF NOT EXISTS campaign_templates (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, template_name)
);

GRANT ALL ON TABLE public.campaign_templates TO service_role;

-- ─── campaigns: novos campos ─────────────────────────────────────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_interval_sec   INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS max_interval_sec   INTEGER NOT NULL DEFAULT 63;

-- ─── campaign_contacts: status invalid para números sem WhatsApp ───────────
ALTER TABLE campaign_contacts
  DROP CONSTRAINT IF EXISTS campaign_contacts_status_check;

ALTER TABLE campaign_contacts
  ADD CONSTRAINT campaign_contacts_status_check
  CHECK (status IN (pending, sent, delivered, read, failed, invalid));
