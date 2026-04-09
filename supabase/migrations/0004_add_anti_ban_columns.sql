-- Migration 004: Add anti-ban and provider configuration columns to campaigns
-- These columns are used by supabase-db.ts and the campaign processing pipeline.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS provider_type     TEXT         NOT NULL DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS delay_min_ms      INTEGER      NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS delay_max_ms      INTEGER      NOT NULL DEFAULT 12000,
  ADD COLUMN IF NOT EXISTS simulate_typing   BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_limit       INTEGER,
  ADD COLUMN IF NOT EXISTS message_variants  JSONB        NOT NULL DEFAULT '[]'::jsonb;
