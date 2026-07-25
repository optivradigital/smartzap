/**
 * WhatsApp Cloud API Error Codes Mapping
 * 
 * Referência: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/
 * Atualizado: 2025-12-02
 * 
 * Categorias:
 * - payment: Problemas de pagamento/billing
 * - rate_limit: Limite de taxa excedido
 * - auth: Autenticação/permissão
 * - template: Problemas com template
 * - recipient: Problemas com destinatário (opt-out, não WhatsApp, etc)
 * - media: Problemas com mídia
 * - system: Erros internos da Meta
 * - integrity: Violações de política/integridade
 * - registration: Problemas com registro de número
 * - unknown: Erros não mapeados
 */

export type ErrorCategory =
  | 'payment'
  | 'rate_limit'
  | 'auth'
  | 'template'
  | 'recipient'
  | 'media'
  | 'system'
  | 'integrity'
  | 'registration'
  | 'unknown'

export interface WhatsAppError {
  code: number
  category: ErrorCategory
  title: string
  userMessage: string
  action: string
  retryable: boolean
}

/**
 * Mapeamento completo de códigos de erro do WhatsApp Cloud API
 */
export const WHATSAPP_ERRORS: Record<number, WhatsAppError> = {
  // ============================================
  // PAGAMENTO / BILLING
  // ============================================
  131042: {
    code: 131042,
    category: 'payment',
    title: 'Business eligibility payment issue',
    userMessage: 'Pagamento pendente na conta Meta. Mensagens não serão entregues.',
    action: 'Regularize o pagamento no Meta Business Suite.',
    retryable: false,
  },

  // ============================================
  // RATE LIMIT / THROTTLING
  // ============================================
  130429: {
    code: 130429,
    category: 'rate_limit',
    title: 'Rate limit hit',
    userMessage: 'Limite de mensagens por segundo atingido.',
    action: 'Aguarde alguns segundos e tente novamente.',
    retryable: true,
  },
  131056: {
    code: 131056,
    category: 'rate_limit',
    title: 'Pair rate limit hit',
    userMessage: 'Muitas mensagens para o mesmo número em curto período.',
    action: 'Aguarde 6 segundos entre mensagens para o mesmo contato.',
    retryable: true,
  },
  131048: {
    code: 131048,
    category: 'rate_limit',
    title: 'Spam rate limit hit',
    userMessage: 'Conta temporariamente limitada por comportamento de spam.',
    action: 'Reduza a frequência de envios e aguarde algumas horas.',
    retryable: true,
  },
  131057: {
    code: 131057,
    category: 'rate_limit',
    title: 'Account in maintenance mode',
    userMessage: 'Conta em modo de manutenção.',
    action: 'Aguarde a Meta concluir a manutenção.',
    retryable: true,
  },

  // ============================================
  // TEMPLATE
  // ============================================
  132000: {
    code: 132000,
    category: 'template',
    title: 'Template param count mismatch',
    userMessage: 'Quantidade de parâmetros do template incorreta.',
    action: 'Verifique os parâmetros do template.',
    retryable: false,
  },
  132001: {
    code: 132001,
    category: 'template',
    title: 'Template does not exist',
    userMessage: 'Template não encontrado ou não aprovado.',
    action: 'Verifique se o template existe e está aprovado.',
    retryable: false,
  },
  132005: {
    code: 132005,
    category: 'template',
    title: 'Template hydrated text too long',
    userMessage: 'Texto do template excede o limite de caracteres.',
    action: 'Reduza o tamanho dos parâmetros.',
    retryable: false,
  },
  132007: {
    code: 132007,
    category: 'template',
    title: 'Template format character policy violated',
    userMessage: 'Template contém caracteres não permitidos.',
    action: 'Remova caracteres especiais ou formatação inválida.',
    retryable: false,
  },
  132012: {
    code: 132012,
    category: 'template',
    title: 'Template param format mismatch',
    userMessage: 'Formato de parâmetro incorreto.',
    action: 'Verifique o tipo dos parâmetros (text, currency, date_time).',
    retryable: false,
  },
  132015: {
    code: 132015,
    category: 'template',
    title: 'Template paused',
    userMessage: 'Template pausado devido à baixa qualidade.',
    action: 'Melhore a qualidade do template ou use outro.',
    retryable: false,
  },
  132016: {
    code: 132016,
    category: 'template',
    title: 'Template disabled',
    userMessage: 'Template desabilitado pela Meta.',
    action: 'Reative o template ou use outro.',
    retryable: false,
  },
  132068: {
    code: 132068,
    category: 'template',
    title: 'Flow is blocked',
    userMessage: 'Fluxo do WhatsApp bloqueado.',
    action: 'Verifique o status do fluxo no Meta Business Suite.',
    retryable: false,
  },
  132069: {
    code: 132069,
    category: 'template',
    title: 'Flow is throttled',
    userMessage: 'Fluxo do WhatsApp com limite de taxa.',
    action: 'Aguarde antes de enviar mais mensagens com este fluxo.',
    retryable: true,
  },

  // ============================================
  // DESTINATÁRIO
  // ============================================
  131021: {
    code: 131021,
    category: 'recipient',
    title: 'Recipient not a valid WhatsApp user',
    userMessage: 'Destinatário não usa WhatsApp.',
    action: 'Verifique se o número está correto.',
    retryable: false,
  },
  131047: {
    code: 131047,
    category: 'recipient',
    title: 'Re-engagement message required',
    userMessage: 'Fora da janela de 24h. Necessário usar template.',
    action: 'Use uma mensagem de template em vez de texto livre.',
    retryable: false,
  },
  131050: {
    code: 131050,
    category: 'recipient',
    title: 'User opted out of marketing messages',
    userMessage: 'Contato optou por não receber mensagens de marketing.',
    action: 'Remova este contato de campanhas de marketing.',
    retryable: false,
  },
  131051: {
    code: 131051,
    category: 'recipient',
    title: 'Unsupported message type',
    userMessage: 'Tipo de mensagem não suportado.',
    action: 'Use um tipo de mensagem compatível.',
    retryable: false,
  },
  470: {
    code: 470,
    category: 'recipient',
    title: 'Outside support window for freeform messages',
    userMessage: 'Fora da janela de 24h para mensagens livres.',
    action: 'Use um template de mensagem aprovado.',
    retryable: false,
  },
  480: {
    code: 480,
    category: 'recipient',
    title: 'Identity change detected',
    userMessage: 'Contato trocou de número ou reinstalou WhatsApp.',
    action: 'Verifique o número do contato.',
    retryable: false,
  },

  // ============================================
  // MÍDIA
  // ============================================
  131052: {
    code: 131052,
    category: 'media',
    title: 'Media download error',
    userMessage: 'Erro ao baixar mídia.',
    action: 'Verifique se a URL da mídia está acessível.',
    retryable: true,
  },
  131053: {
    code: 131053,
    category: 'media',
    title: 'Media upload error',
    userMessage: 'Erro ao fazer upload da mídia.',
    action: 'Tente novamente com um arquivo menor ou diferente formato.',
    retryable: true,
  },
  131054: {
    code: 131054,
    category: 'media',
    title: 'Media file not found',
    userMessage: 'Arquivo de mídia não encontrado.',
    action: 'Faça upload novamente da mídia.',
    retryable: true,
  },

  // ============================================
  // AUTENTICAÇÃO / PERMISSÕES
  // ============================================
  190: {
    code: 190,
    category: 'auth',
    title: 'Access token expired',
    userMessage: 'Token de acesso expirado.',
    action: 'Gere um novo token de acesso.',
    retryable: false,
  },
  131031: {
    code: 131031,
    category: 'auth',
    title: 'Account locked',
    userMessage: 'Conta bloqueada pela Meta.',
    action: 'Entre em contato com o suporte da Meta.',
    retryable: false,
  },
  131045: {
    code: 131045,
    category: 'auth',
    title: 'Incorrect certificate',
    userMessage: 'Certificado de autenticação incorreto.',
    action: 'Verifique as configurações de certificado.',
    retryable: false,
  },
  131046: {
    code: 131046,
    category: 'auth',
    title: 'Two-step verification PIN required',
    userMessage: 'PIN de verificação em duas etapas necessário.',
    action: 'Configure o PIN no Meta Business Suite.',
    retryable: false,
  },
  131049: {
    code: 131049,
    category: 'rate_limit',
    title: 'Message not delivered to maintain healthy ecosystem engagement',
    userMessage: 'Mensagem não entregue para manter a integridade do ecossistema (limite de engajamento da Meta).',
    action: 'Comum ao enviar marketing para o próprio número do WhatsApp Business ou para contatos de baixo engajamento. Tente outro número de teste.',
    retryable: false,
  },
  10: {
    code: 10,
    category: 'auth',
    title: 'Permission denied',
    userMessage: 'Permissão negada para esta operação.',
    action: 'Verifique as permissões do token de acesso.',
    retryable: false,
  },
  100: {
    code: 100,
    category: 'auth',
    title: 'Invalid parameter',
    userMessage: 'Parâmetro inválido na requisição.',
    action: 'Verifique os parâmetros enviados.',
    retryable: false,
  },
  137000: {
    code: 137000,
    category: 'auth',
    title: 'Identity key mismatch',
    userMessage: 'Chave de identidade não corresponde.',
    action: 'Verifique a identidade do destinatário.',
    retryable: false,
  },

  // ============================================
  // SISTEMA / ERROS GENÉRICOS
  // ============================================
  131000: {
    code: 131000,
    category: 'system',
    title: 'Something went wrong',
    userMessage: 'Erro interno da Meta.',
    action: 'Tente novamente em alguns minutos.',
    retryable: true,
  },
  131026: {
    code: 131026,
    category: 'recipient',
    title: 'Message undeliverable',
    userMessage: 'Número não possui WhatsApp ativo ou está desconectado.',
    action: 'Verifique se o número está cadastrado no WhatsApp.',
    retryable: false,
  },
  500: {
    code: 500,
    category: 'system',
    title: 'Internal server error',
    userMessage: 'Erro interno do servidor.',
    action: 'Tente novamente.',
    retryable: true,
  },
  501: {
    code: 501,
    category: 'system',
    title: 'Unknown message type',
    userMessage: 'Tipo de mensagem desconhecido.',
    action: 'Use um tipo de mensagem válido.',
    retryable: false,
  },
  503: {
    code: 503,
    category: 'system',
    title: 'Service unavailable',
    userMessage: 'Serviço temporariamente indisponível.',
    action: 'Aguarde e tente novamente.',
    retryable: true,
  },
  1: {
    code: 1,
    category: 'system',
    title: 'API Unknown',
    userMessage: 'Erro desconhecido na API.',
    action: 'Tente novamente ou contate o suporte.',
    retryable: true,
  },
  2: {
    code: 2,
    category: 'system',
    title: 'API Service',
    userMessage: 'Serviço da API temporariamente indisponível.',
    action: 'Aguarde alguns minutos e tente novamente.',
    retryable: true,
  },
  4: {
    code: 4,
    category: 'rate_limit',
    title: 'API Too Many Calls',
    userMessage: 'Muitas chamadas à API.',
    action: 'Reduza a frequência de requisições.',
    retryable: true,
  },
  17: {
    code: 17,
    category: 'rate_limit',
    title: 'API User Too Many Calls',
    userMessage: 'Usuário excedeu o limite de chamadas.',
    action: 'Aguarde antes de fazer novas requisições.',
    retryable: true,
  },
  80007: {
    code: 80007,
    category: 'rate_limit',
    title: 'Rate limit on Cloud API',
    userMessage: 'Limite de taxa da Cloud API atingido.',
    action: 'Reduza a frequência de chamadas à API.',
    retryable: true,
  },
  133016: {
    code: 133016,
    category: 'rate_limit',
    title: 'Incompliant message send rate',
    userMessage: 'Taxa de envio de mensagens excede limites permitidos.',
    action: 'Ajuste a velocidade de envio conforme seu tier.',
    retryable: true,
  },

  // ============================================
  // INTEGRIDADE / POLÍTICAS
  // ============================================
  368: {
    code: 368,
    category: 'integrity',
    title: 'Temporarily blocked for policies violations',
    userMessage: 'Conta temporariamente bloqueada por violar políticas.',
    action: 'Revise as políticas do WhatsApp e aguarde desbloqueio.',
    retryable: false,
  },
  130497: {
    code: 130497,
    category: 'integrity',
    title: 'Business account locked',
    userMessage: 'Conta comercial bloqueada por violação de políticas.',
    action: 'Contate o suporte da Meta para resolver.',
    retryable: false,
  },

  // ============================================
  // REGISTRO / MIGRAÇÃO DE NÚMERO
  // ============================================
  2388001: {
    code: 2388001,
    category: 'registration',
    title: 'Phone number migration in progress',
    userMessage: 'Migração do número de telefone em andamento.',
    action: 'Aguarde a conclusão da migração.',
    retryable: true,
  },
  2388012: {
    code: 2388012,
    category: 'registration',
    title: 'Phone number already registered',
    userMessage: 'Número de telefone já registrado em outra conta.',
    action: 'Use um número diferente ou transfira o existente.',
    retryable: false,
  },
  2388091: {
    code: 2388091,
    category: 'registration',
    title: 'Phone number verification failed',
    userMessage: 'Verificação do número de telefone falhou.',
    action: 'Tente verificar novamente com código correto.',
    retryable: true,
  },
  2388093: {
    code: 2388093,
    category: 'registration',
    title: 'Phone number not eligible',
    userMessage: 'Número não elegível para registro.',
    action: 'Use um número de telefone válido e não VOIP.',
    retryable: false,
  },
  2388103: {
    code: 2388103,
    category: 'registration',
    title: 'Phone number registration limit reached',
    userMessage: 'Limite de registros de números atingido.',
    action: 'Remova números antigos ou contate suporte.',
    retryable: false,
  },
  2494100: {
    code: 2494100,
    category: 'registration',
    title: 'Phone number not linked to WABA',
    userMessage: 'Número não vinculado à conta WABA.',
    action: 'Vincule o número no Meta Business Suite.',
    retryable: false,
  },

  // ============================================
  // CRIAÇÃO DE TEMPLATE
  // ============================================
  2388040: {
    code: 2388040,
    category: 'template',
    title: 'Template category not supported',
    userMessage: 'Categoria do template não suportada.',
    action: 'Use uma categoria válida: MARKETING, UTILITY ou AUTHENTICATION.',
    retryable: false,
  },
  2388047: {
    code: 2388047,
    category: 'template',
    title: 'Template name already exists',
    userMessage: 'Já existe um template com este nome.',
    action: 'Use um nome diferente para o template.',
    retryable: false,
  },
  2388072: {
    code: 2388072,
    category: 'template',
    title: 'Template content violates policy',
    userMessage: 'Conteúdo do template viola políticas do WhatsApp.',
    action: 'Revise o conteúdo conforme diretrizes da Meta.',
    retryable: false,
  },
  2388073: {
    code: 2388073,
    category: 'template',
    title: 'Template language not supported',
    userMessage: 'Idioma do template não suportado.',
    action: 'Use um código de idioma válido (ex: pt_BR).',
    retryable: false,
  },
  2388293: {
    code: 2388293,
    category: 'template',
    title: 'Template component validation failed',
    userMessage: 'Validação de componente do template falhou.',
    action: 'Verifique header, body, footer e botões do template.',
    retryable: false,
  },
  2388299: {
    code: 2388299,
    category: 'template',
    title: 'Template limit reached',
    userMessage: 'Limite de templates atingido.',
    action: 'Delete templates não utilizados.',
    retryable: false,
  },
  2388019: {
    code: 2388019,
    category: 'template',
    title: 'Template not approved',
    userMessage: 'Template ainda não foi aprovado pela Meta.',
    action: 'Aguarde aprovação ou revise e reenvie o template.',
    retryable: false,
  },

  // ============================================
  // INSIGHTS DE TEMPLATE
  // ============================================
  200005: {
    code: 200005,
    category: 'template',
    title: 'Template insights not available',
    userMessage: 'Insights do template não disponíveis.',
    action: 'Template precisa ter envios para gerar insights.',
    retryable: false,
  },
  200006: {
    code: 200006,
    category: 'template',
    title: 'Template insight date range invalid',
    userMessage: 'Período de insights do template inválido.',
    action: 'Use um período de até 90 dias.',
    retryable: false,
  },
  200007: {
    code: 200007,
    category: 'template',
    title: 'Template insights temporarily unavailable',
    userMessage: 'Insights temporariamente indisponíveis.',
    action: 'Tente novamente mais tarde.',
    retryable: true,
  },

  // ============================================
  // CONTA WABA
  // ============================================
  2593079: {
    code: 2593079,
    category: 'auth',
    title: 'WABA not found',
    userMessage: 'Conta WhatsApp Business não encontrada.',
    action: 'Verifique o ID da conta WABA.',
    retryable: false,
  },
  2593085: {
    code: 2593085,
    category: 'auth',
    title: 'WABA access denied',
    userMessage: 'Acesso negado à conta WhatsApp Business.',
    action: 'Verifique permissões no Meta Business Suite.',
    retryable: false,
  },
  2593107: {
    code: 2593107,
    category: 'system',
    title: 'WABA sync in progress',
    userMessage: 'Sincronização da conta WABA em andamento.',
    action: 'Aguarde a sincronização ser concluída.',
    retryable: true,
  },
  2593108: {
    code: 2593108,
    category: 'system',
    title: 'WABA sync failed',
    userMessage: 'Falha na sincronização da conta WABA.',
    action: 'Tente sincronizar novamente.',
    retryable: true,
  },

  // ============================================
  // ERROS DE AUTENTICAÇÃO ADICIONAIS
  // ============================================
  0: {
    code: 0,
    category: 'auth',
    title: 'AuthException',
    userMessage: 'Erro de autenticação.',
    action: 'Verifique o token de acesso.',
    retryable: false,
  },
  3: {
    code: 3,
    category: 'auth',
    title: 'API Method',
    userMessage: 'Método da API não permitido.',
    action: 'Use o método HTTP correto para este endpoint.',
    retryable: false,
  },
  200: {
    code: 200,
    category: 'auth',
    title: 'Permission denied',
    userMessage: 'Permissão negada.',
    action: 'Solicite as permissões necessárias no app.',
    retryable: false,
  },
  294: {
    code: 294,
    category: 'auth',
    title: 'Managing app with mobile not allowed',
    userMessage: 'Gerenciamento via mobile não permitido.',
    action: 'Use a versão desktop do Meta Business Suite.',
    retryable: false,
  },

  // ============================================
  // OUTROS ERROS
  // ============================================
  33: {
    code: 33,
    category: 'system',
    title: 'Parameter format mismatch',
    userMessage: 'Formato de parâmetro incorreto.',
    action: 'Verifique o formato dos dados enviados.',
    retryable: false,
  },
  130472: {
    code: 130472,
    category: 'recipient',
    title: 'User number part of experiment',
    userMessage: 'Número faz parte de experimento da Meta.',
    action: 'Tente novamente mais tarde.',
    retryable: true,
  },
  131005: {
    code: 131005,
    category: 'auth',
    title: 'Access denied',
    userMessage: 'Acesso negado ao recurso.',
    action: 'Verifique as permissões do token.',
    retryable: false,
  },
  131008: {
    code: 131008,
    category: 'system',
    title: 'Required parameter is missing',
    userMessage: 'Parâmetro obrigatório ausente.',
    action: 'Inclua todos os parâmetros necessários.',
    retryable: false,
  },
  131009: {
    code: 131009,
    category: 'system',
    title: 'Parameter value is not valid',
    userMessage: 'Valor de parâmetro inválido.',
    action: 'Verifique os valores enviados.',
    retryable: false,
  },
  131016: {
    code: 131016,
    category: 'system',
    title: 'Service temporarily unavailable',
    userMessage: 'Serviço temporariamente indisponível.',
    action: 'Aguarde e tente novamente.',
    retryable: true,
  },
  131037: {
    code: 131037,
    category: 'recipient',
    title: 'Phone number format incorrect',
    userMessage: 'Formato do número de telefone incorreto.',
    action: 'Use formato E.164 (ex: +5511999999999).',
    retryable: false,
  },
  133000: {
    code: 133000,
    category: 'media',
    title: 'Generic media error',
    userMessage: 'Erro genérico de mídia.',
    action: 'Verifique o arquivo de mídia.',
    retryable: true,
  },
  133004: {
    code: 133004,
    category: 'media',
    title: 'Media file size too big',
    userMessage: 'Arquivo de mídia muito grande.',
    action: 'Reduza o tamanho do arquivo (máx 16MB para imagens).',
    retryable: false,
  },
  133005: {
    code: 133005,
    category: 'media',
    title: 'Media file type not supported',
    userMessage: 'Tipo de arquivo de mídia não suportado.',
    action: 'Use formatos suportados (JPEG, PNG, MP4, etc).',
    retryable: false,
  },
  133006: {
    code: 133006,
    category: 'media',
    title: 'Media file corrupted',
    userMessage: 'Arquivo de mídia corrompido.',
    action: 'Use um arquivo diferente.',
    retryable: false,
  },
  133008: {
    code: 133008,
    category: 'media',
    title: 'Media file not found on server',
    userMessage: 'Arquivo de mídia não encontrado no servidor.',
    action: 'Faça upload novamente.',
    retryable: true,
  },
  133009: {
    code: 133009,
    category: 'media',
    title: 'Media file hash mismatch',
    userMessage: 'Hash do arquivo de mídia não confere.',
    action: 'Faça upload novamente do arquivo.',
    retryable: true,
  },
  133010: {
    code: 133010,
    category: 'registration',
    title: 'Account not registered',
    userMessage: 'Número não registrado na Cloud API. Registre o número em developers.facebook.com → WhatsApp → Configuração.',
    action: 'Acesse Meta for Developers, abra o app, vá em WhatsApp > Configuração e clique em Registrar número.',
    retryable: false,
  },
  133015: {
    code: 133015,
    category: 'media',
    title: 'Media ID invalid',
    userMessage: 'ID da mídia inválido.',
    action: 'Use um ID de mídia válido.',
    retryable: false,
  },
  134011: {
    code: 134011,
    category: 'system',
    title: 'Business phone number not found',
    userMessage: 'Número de telefone comercial não encontrado.',
    action: 'Verifique o phone_number_id nas configurações.',
    retryable: false,
  },
  135000: {
    code: 135000,
    category: 'system',
    title: 'Generic error',
    userMessage: 'Erro genérico do servidor.',
    action: 'Tente novamente.',
    retryable: true,
  },

  // ============================================
  // MARKETING API
  // ============================================
  131055: {
    code: 131055,
    category: 'recipient',
    title: 'User has not accepted privacy policy',
    userMessage: 'Usuário não aceitou a política de privacidade atualizada.',
    action: 'Usuário precisa aceitar os novos termos no WhatsApp.',
    retryable: false,
  },
  134100: {
    code: 134100,
    category: 'template',
    title: 'Marketing template required',
    userMessage: 'Template de marketing obrigatório para esta operação.',
    action: 'Use um template de categoria MARKETING.',
    retryable: false,
  },
  134101: {
    code: 134101,
    category: 'template',
    title: 'Marketing message frequency cap',
    userMessage: 'Limite de frequência de mensagens de marketing atingido.',
    action: 'Aguarde antes de enviar novas mensagens de marketing.',
    retryable: true,
  },
  134102: {
    code: 134102,
    category: 'recipient',
    title: 'User not eligible for marketing messages',
    userMessage: 'Usuário não elegível para receber marketing.',
    action: 'Remova este contato de campanhas de marketing.',
    retryable: false,
  },
  1752041: {
    code: 1752041,
    category: 'template',
    title: 'Marketing message blocked by user preference',
    userMessage: 'Mensagem de marketing bloqueada por preferência do usuário.',
    action: 'Remova o contato da lista de marketing.',
    retryable: false,
  },
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Mapeia um código de erro para informações detalhadas
 */
export function mapWhatsAppError(code: number): WhatsAppError {
  return WHATSAPP_ERRORS[code] || {
    code,
    category: 'unknown',
    title: 'Unknown error',
    userMessage: `Erro desconhecido (código ${code}).`,
    action: 'Entre em contato com o suporte.',
    retryable: false,
  }
}

/**
 * Verifica se é erro de pagamento
 */
export function isPaymentError(code: number): boolean {
  return mapWhatsAppError(code).category === 'payment'
}

/**
 * Verifica se é erro de rate limit
 */
export function isRateLimitError(code: number): boolean {
  return mapWhatsAppError(code).category === 'rate_limit'
}

/**
 * Verifica se o erro é retryable (pode tentar novamente)
 */
export function isRetryableError(code: number): boolean {
  return mapWhatsAppError(code).retryable
}

/**
 * Retorna a categoria do erro
 */
export function getErrorCategory(code: number): ErrorCategory {
  return mapWhatsAppError(code).category
}

/**
 * Retorna mensagem amigável para o usuário
 */
export function getUserFriendlyMessage(code: number): string {
  return mapWhatsAppError(code).userMessage
}

/**
 * Retorna ação recomendada
 */
export function getRecommendedAction(code: number): string {
  return mapWhatsAppError(code).action
}

/**
 * Erros críticos que devem gerar alerta global
 */
export const CRITICAL_ERROR_CODES = [
  131042, // Payment issue
  131031, // Account locked
  131049, // Not delivered — ecosystem engagement limit
  190,    // Token expired
  368,    // Temporarily blocked for policies violations
  130497, // Business account locked
]

/**
 * Verifica se é um erro crítico
 */
export function isCriticalError(code: number): boolean {
  return CRITICAL_ERROR_CODES.includes(code)
}

/**
 * Erros que indicam opt-out do contato
 */
export const OPT_OUT_ERROR_CODES = [
  131050, // User opted out of marketing
  131055, // User has not accepted privacy policy
  134102, // User not eligible for marketing messages
  1752041, // Marketing message blocked by user preference
]

/**
 * Verifica se é erro de opt-out
 */
export function isOptOutError(code: number): boolean {
  return OPT_OUT_ERROR_CODES.includes(code)
}

/**
 * Cores para badges na UI
 */
export const ERROR_CATEGORY_COLORS: Record<ErrorCategory, string> = {
  payment: 'red',
  rate_limit: 'yellow',
  auth: 'red',
  template: 'orange',
  recipient: 'gray',
  media: 'blue',
  system: 'gray',
  integrity: 'red',
  registration: 'purple',
  unknown: 'gray',
}

/**
 * Ícones para badges na UI (lucide-react)
 */
export const ERROR_CATEGORY_ICONS: Record<ErrorCategory, string> = {
  payment: 'CreditCard',
  rate_limit: 'Clock',
  auth: 'Lock',
  template: 'FileText',
  recipient: 'User',
  media: 'Image',
  system: 'Settings',
  integrity: 'ShieldX',
  registration: 'Phone',
  unknown: 'HelpCircle',
}

/**
 * Labels em português para categorias
 */
export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  payment: 'Pagamento',
  rate_limit: 'Limite de Taxa',
  auth: 'Autenticação',
  template: 'Template',
  recipient: 'Destinatário',
  media: 'Mídia',
  system: 'Sistema',
  integrity: 'Integridade',
  registration: 'Registro',
  unknown: 'Desconhecido',
}
