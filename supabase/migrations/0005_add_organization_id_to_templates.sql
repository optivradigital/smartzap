-- Migration 005: Add organization_id to templates table
-- Enables multi-tenant isolation for Evolution API orgs (Meta orgs use the Meta API directly).
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards).

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_templates_organization_id
  ON templates(organization_id);

-- Replace the global unique constraint on name with a per-org unique constraint.
-- NULLS NOT DISTINCT ensures two rows with the same name and NULL org_id still conflict
-- (maintains backward compat for templates created before multi-tenancy).
ALTER TABLE templates
  DROP CONSTRAINT IF EXISTS templates_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_name_org
  ON templates(name, organization_id)
  NULLS NOT DISTINCT;
