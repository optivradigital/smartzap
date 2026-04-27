-- Migration 007: Stripe subscriptions table

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT UNIQUE,
  status                TEXT NOT NULL DEFAULT 'inactive',
  plan                  TEXT NOT NULL DEFAULT 'basic',
  extra_numbers         INTEGER NOT NULL DEFAULT 0,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Add stripe_customer_id to organizations for quick lookup
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
