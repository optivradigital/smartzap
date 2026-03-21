-- =============================================================================
-- Migration 004: WhatsApp Provider + Anti-Ban Support
-- Adiciona suporte a Evolution API e configurações anti-ban em campanhas
-- =============================================================================

-- Campos anti-ban na tabela campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS provider_type       TEXT DEFAULT 'meta',   -- 'meta' | 'evolution'
  ADD COLUMN IF NOT EXISTS delay_min_ms        INTEGER DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS delay_max_ms        INTEGER DEFAULT 12000,
  ADD COLUMN IF NOT EXISTS simulate_typing     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_limit         INTEGER,               -- null = sem limite
  ADD COLUMN IF NOT EXISTS message_variants    JSONB DEFAULT '[]'::jsonb; -- array de strings (spinning)

-- Comentários para documentação
COMMENT ON COLUMN campaigns.provider_type     IS 'Provider WhatsApp: meta (Cloud API) ou evolution (Baileys via Evolution API)';
COMMENT ON COLUMN campaigns.delay_min_ms      IS 'Delay mínimo entre mensagens em ms (anti-ban)';
COMMENT ON COLUMN campaigns.delay_max_ms      IS 'Delay máximo entre mensagens em ms (anti-ban)';
COMMENT ON COLUMN campaigns.simulate_typing   IS 'Simular indicador de digitação antes de enviar (Evolution apenas)';
COMMENT ON COLUMN campaigns.daily_limit       IS 'Limite máximo de mensagens por dia para este número (warm-up)';
COMMENT ON COLUMN campaigns.message_variants  IS 'Array de variações de texto para spinning (escolha aleatória por contato)';
