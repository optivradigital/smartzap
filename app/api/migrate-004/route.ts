/**
 * ROTA TEMPORÁRIA — remover após executar uma vez
 * Adiciona colunas anti-ban à tabela campaigns
 */
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migrate-secret')
  if (secret !== process.env.SMARTZAP_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Deriva a connection string a partir das variáveis de ambiente
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const ref = supabaseUrl.replace('https://', '').replace('.supabase.co', '').replace(/\/.*/, '')

  // Tenta as formas conhecidas de connection string do Supabase
  const connectionStrings = [
    // Pooler transaction mode (porta 6543)
    `postgresql://postgres.${ref}:${serviceKey}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:${serviceKey}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
    // Direto (porta 5432, requer IPv6 ou DATABASE_URL explícita)
    process.env.DATABASE_URL || '',
    process.env.POSTGRES_URL  || '',
  ].filter(Boolean)

  let lastError = ''
  for (const connStr of connectionStrings) {
    const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 })
    try {
      const client = await pool.connect()
      await client.query(`
        ALTER TABLE campaigns
          ADD COLUMN IF NOT EXISTS provider_type    TEXT    NOT NULL DEFAULT 'meta',
          ADD COLUMN IF NOT EXISTS delay_min_ms     INTEGER NOT NULL DEFAULT 3000,
          ADD COLUMN IF NOT EXISTS delay_max_ms     INTEGER NOT NULL DEFAULT 12000,
          ADD COLUMN IF NOT EXISTS simulate_typing  BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS daily_limit      INTEGER,
          ADD COLUMN IF NOT EXISTS message_variants JSONB   NOT NULL DEFAULT '[]'::jsonb
      `)
      // Verifica resultado
      const { rows } = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'campaigns'
        AND column_name IN ('delay_min_ms','delay_max_ms','provider_type','simulate_typing','daily_limit','message_variants')
        ORDER BY column_name
      `)
      client.release()
      await pool.end()
      return NextResponse.json({ ok: true, columns: rows.map(r => r.column_name), connStr: connStr.substring(0, 40) + '...' })
    } catch (e) {
      lastError = (e as Error).message
      await pool.end().catch(() => {})
    }
  }

  return NextResponse.json({ ok: false, error: lastError }, { status: 500 })
}
