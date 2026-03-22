-- =============================================================================
-- Migration 005: Multi-User Authentication
-- Adiciona suporte a múltiplos usuários com email + senha
-- =============================================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS smartzap_users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de sessões
CREATE TABLE IF NOT EXISTS smartzap_sessions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES smartzap_users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_smartzap_sessions_token ON smartzap_sessions(token);
CREATE INDEX IF NOT EXISTS idx_smartzap_sessions_expires ON smartzap_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_smartzap_users_email ON smartzap_users(email);

-- RLS: desabilitar (app usa service role key)
ALTER TABLE smartzap_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE smartzap_sessions DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE smartzap_users IS 'Usuários do SmartZap com email/senha';
COMMENT ON TABLE smartzap_sessions IS 'Sessões autenticadas dos usuários';
