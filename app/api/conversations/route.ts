/**
 * API Route: Conversations
 * 
 * GET /api/conversations - Listar todas as conversas
 */

import { NextRequest, NextResponse } from 'next/server'
import { botConversationDb, botDb } from '@/lib/supabase-db'
import { getRequestOrgId } from '@/lib/org-context'

/**
 * GET /api/conversations
 * 
 * Retorna lista de conversas com paginação e filtros
 * 
 * Query params:
 * - status: 'active' | 'paused' | 'ended'
 * - botId: Filtrar por bot específico
 * - limit: Número de resultados (default: 50)
 * - offset: Paginação offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const botId = searchParams.get('botId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const orgId = await getRequestOrgId()

    // Buscar conversas filtradas pela org ativa
    const conversations = await botConversationDb.getAll({
      organizationId: orgId || undefined,
    })

    // Aplicar filtros
    let filtered = conversations

    if (status) {
      filtered = filtered.filter(c => c.status === status)
    }

    if (botId) {
      filtered = filtered.filter(c => c.botId === botId)
    }

    // Ordenar por última atividade (mais recente primeiro)
    filtered.sort((a, b) => {
      const dateA = new Date(a.lastMessageAt || a.createdAt).getTime()
      const dateB = new Date(b.lastMessageAt || b.createdAt).getTime()
      return dateB - dateA
    })

    // Aplicar paginação
    const total = filtered.length
    const paginated = filtered.slice(offset, offset + limit)

    // Buscar informações adicionais dos bots
    const botsInfo: Record<string, { name: string }> = {}
    const uniqueBotIds = [...new Set(paginated.map(c => c.botId))]

    await Promise.all(
      uniqueBotIds.map(async (id) => {
        const bot = await botDb.getById(id)
        if (bot) {
          botsInfo[id] = { name: bot.name }
        }
      })
    )

    // Enriquecer conversas com nome do bot
    const enriched = paginated.map(c => ({
      ...c,
      botName: botsInfo[c.botId]?.name || 'Bot desconhecido',
    }))

    return NextResponse.json({
      conversations: enriched,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    })
  } catch (error) {
    console.error('Erro ao listar conversas:', error)
    return NextResponse.json(
      { error: 'Erro interno ao listar conversas' },
      { status: 500 }
    )
  }
}
