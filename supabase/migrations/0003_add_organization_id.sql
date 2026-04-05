-- Migration 003: Add organization_id to campaigns, contacts and campaign_contacts
-- Enables proper multi-tenant isolation per organization
-- Note: existing data is deleted since this is a pre-production environment

-- =============================================================================
-- LIMPAR DADOS PRÉ-MULTITENANCY
-- =============================================================================

TRUNCATE TABLE campaign_contacts CASCADE;
TRUNCATE TABLE campaigns CASCADE;
TRUNCATE TABLE contacts CASCADE;

-- =============================================================================
-- CAMPAIGNS
-- =============================================================================

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_campaigns_organization_id
  ON campaigns(organization_id);

-- =============================================================================
-- CONTACTS
-- =============================================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Remove unique constraint global de phone (phone deve ser único por org, não globalmente)
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_phone_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_phone_org
  ON contacts(phone, organization_id);

CREATE INDEX IF NOT EXISTS idx_contacts_organization_id
  ON contacts(organization_id);

-- =============================================================================
-- CAMPAIGN_CONTACTS
-- =============================================================================

ALTER TABLE campaign_contacts
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_organization_id
  ON campaign_contacts(organization_id);
