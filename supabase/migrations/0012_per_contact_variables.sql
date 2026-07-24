-- Permite placeholders {{2}}, {{3}}... diferentes por contato, vindos de colunas da planilha.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS variable_column_map JSONB;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS variables JSONB;
