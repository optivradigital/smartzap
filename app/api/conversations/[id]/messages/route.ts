/**
 * API Route: Send Message to Conversation
 * 
 * POST /api/conversations/[id]/messages - Enviar mensagem manual para uma conversa
 */

import { NextResponse } from 'next/server'
import { botConversationDb, botMessageDb, botDb } from '@/lib/supabase-db'
import { buildTextMessage } from '@/lib/whatsapp/text'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { requireAnyUser } from '@/lib/role-guard'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/conversations/[id]/messages
 * 
 * Envia mensagem manual do atendente para o contato
 * 
 * Body:
 * - text: string - Texto da mensagem
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { error: authError, user } = await requireAnyUser()
    if (authError) return authError
    const orgId = user.organizationId || null

    const { id } = await params
    const body = await request.json()
    const { text } = body as { text: string }

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json(
        { error: 'Texto da mensagem é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se conversa existe
    const conversation = await botConversationDb.getById(id)
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se conversa está em atendimento humano
    if (conversation.status !== 'paused') {
      return NextResponse.json(
        { error: 'Conversa deve estar em atendimento humano para enviar mensagens manuais. Use /takeover primeiro.' },
        { status: 400 }
      )
    }

    // Buscar bot para obter phone_number_id
    const bot = await botDb.getById(conversation.botId)
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot não encontrado' },
        { status: 404 }
      )
    }

    // Buscar credenciais do WhatsApp
    const credentials = await getWhatsAppCredentials(orgId)
    if (!credentials) {
      return NextResponse.json(
        { error: 'Credenciais do WhatsApp não configuradas' },
        { status: 500 }
      )
    }

    // Construir payload da mensagem
    const messagePayload = buildTextMessage({
      to: conversation.contactPhone,
      text: text.trim(),
    })

    // Enviar via Meta API
    const response = await fetch(
      `https://graph.facebook.com/v24.0/${bot.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      console.error('Erro ao enviar mensagem WhatsApp:', result)
      return NextResponse.json(
        {
          error: 'Erro ao enviar mensagem pelo WhatsApp',
          details: result.error?.message || 'Erro desconhecido'
        },
        { status: response.status }
      )
    }

    // Salvar mensagem no banco
    const waMessageId = result.messages?.[0]?.id
    const savedMessage = await botMessageDb.create({
      conversationId: id,
      content: { text: text.trim() },
      type: 'text',
      direction: 'outbound',
      status: 'sent',
      waMessageId,
      origin: 'operator',
    })

    // Atualizar última mensagem da conversa
    await botConversationDb.update(id, {
      lastMessageAt: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: savedMessage,
      waMessageId,
    })
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error)
    return NextResponse.json(
      { error: 'Erro interno ao enviar mensagem' },
      { status: 500 }
    )
  }
}
