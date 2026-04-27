-- Migration 006: Clerk user ID + trial support

ALTER TABLE smartzap_users
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';

-- Default: 14-day trial for all existing orgs without a trial date
UPDATE organizations
  SET trial_ends_at = NOW() + INTERVAL '14 days'
  WHERE trial_ends_at IS NULL;
