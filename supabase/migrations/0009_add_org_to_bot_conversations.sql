-- Migration 009: Add organization_id to bot_conversations for multi-tenant isolation
-- Apply manually in Supabase SQL Editor before deploying this version

ALTER TABLE bot_conversations
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_bot_conversations_org
  ON bot_conversations(organization_id);
