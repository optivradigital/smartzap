import { z } from 'zod'
import { CreateTemplateSchema } from './validators/template.schema'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { templateProjectDb } from '@/lib/supabase-db'
import { CreateTemplateInput, TemplateCreationResult } from './types'
import { MetaComponent, MetaButton, MetaHeaderComponent, MetaBodyComponent, MetaCarouselComponent, MetaTemplatePayload } from './types'
import { MetaAPIError } from './errors'
import { GeneratedTemplate } from '@/lib/ai/services/template-agent'

export class TemplateService {
    /**
     * Creates a WhatsApp Template (orchestrates Validation, Transformation, Sending, and DB Update)
     */
    async create(data: CreateTemplateInput, orgId?: string | null): Promise<TemplateCreationResult> {
        // 1. Authenticate / Get Credentials
        const credentials = await getWhatsAppCredentials(orgId)
        if (!credentials) {
            throw new Error('WhatsApp credentials not found')
        }

        // 2. Build the Strict Meta Payload
        const metaPayload = this.buildMetaPayload(data)

        // 3. Send to Meta API
        // URL da API (Versão atualizada v24.0)
        const url = `https://graph.facebook.com/v24.0/${credentials.businessAccountId}/message_templates`

        try {
            const response = await fetch(
                url,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${credentials.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(metaPayload),
                }
            )

            const result = await response.json()

            if (!response.ok) {
                console.error('[TemplateService] Meta API Error:', JSON.stringify(result, null, 2))
                // Throw typed Error
                throw new MetaAPIError(result.error)
            }

            // 4. Update Database (if projectId/itemId provided)
            // This makes the service "State Aware" which is useful for our SaaS
            if (data.itemId) {
                try {
                    await templateProjectDb.updateItem(data.itemId, {
                        meta_id: result.id,
                        meta_status: result.status || 'PENDING'
                    })
                } catch (dbErr) {
                    console.error(`[TemplateService] Failed to update DB for item ${data.itemId}`, dbErr)
                    // We do NOT throw here, as the template was successfully created on Meta
                }
            }

            return {
                success: true,
                name: metaPayload.name,
                id: result.id,
                status: result.status || 'PENDING',
                category: metaPayload.category
            }

        } catch (error: any) {
            // If it's already our typed error, rethrow
            if (error instanceof MetaAPIError) {
                throw error
            }
            // If network error or other generic error
            console.error('[TemplateService] Network/Unknown Error:', error)
            throw new Error(error.message || 'Falha na comunicação com a Meta')
        }
    }

    /**
     * Calls the AI Agent API to generate utility templates
     */
    async generateUtilityTemplates(params: {
        prompt: string;
        quantity: number;
        language: 'pt_BR' | 'en_US' | 'es_ES';
        strategy: 'marketing' | 'utility' | 'bypass';
    }): Promise<{ templates: GeneratedTemplate[] }> {
        console.log('[TemplateService] generateUtilityTemplates called with params:', JSON.stringify(params, null, 2));

        const response = await fetch('/api/ai/generate-utility-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Falha ao gerar templates')
        }

        return await response.json()
    }

    // Criar template diretamente na Meta via API
    async createInMeta(template: { name: string; content: string; language?: string; category?: string }): Promise<{ success: boolean; message: string }> {
        const response = await fetch('/api/templates/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: template.name,
                content: template.content,
                language: template.language || 'pt_BR',
                category: template.category || 'UTILITY'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Falha ao criar template na Meta');
        }

        return await response.json();
    }

    /**
     * Transforms the User Input (friendly) into Meta Payload (strict)
     */
    private buildMetaPayload(data: CreateTemplateInput): MetaTemplatePayload {
        const components: MetaComponent[] = []

        // A. Header
        if (data.header) {
            const headerComponent: MetaHeaderComponent = {
                type: 'HEADER',
                format: data.header.format as any
            }

            if (data.header.format === 'TEXT' && data.header.text) {
                headerComponent.text = this.renumberVariables(data.header.text)
                const varCount = this.extractVariables(headerComponent.text)
                if (varCount > 0) {
                    // Use provided example vars or generate generic ones
                    const examples = data.header.example?.header_text || Array(varCount).fill('Exemplo')
                    headerComponent.example = { header_text: examples }
                }
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(data.header.format)) {
                // Media headers require an example handle
                if (data.header.example?.header_handle && data.header.example.header_handle.length > 0) {
                    headerComponent.example = { header_handle: data.header.example.header_handle }
                }
            }
            components.push(headerComponent)
        }

        // B. Body (or Content)
        let bodyText = data.body?.text || data.content || ''
        if (bodyText) {
            bodyText = this.renumberVariables(bodyText)
            const bodyComponent: MetaBodyComponent = {
                type: 'BODY',
                text: bodyText
            }

            const varCount = this.extractVariables(bodyText)
            if (varCount > 0) {
                let exampleValues: string[] = []
                if (data.exampleVariables && data.exampleVariables.length > 0) {
                    // Ensure we provide exactly as many examples as variables
                    exampleValues = data.exampleVariables.slice(0, varCount)
                    // If we still don't have enough, pad with placeholders
                    while (exampleValues.length < varCount) {
                        exampleValues.push(`Valor${exampleValues.length + 1}`)
                    }
                } else {
                    exampleValues = Array.from({ length: varCount }, (_, i) => `Valor${i + 1}`)
                }

                const finalBodyExamples = data.body?.example?.body_text || [exampleValues]
                bodyComponent.example = { body_text: finalBodyExamples }
            }
            components.push(bodyComponent)
        }

        // C. Footer
        if (data.footer && data.footer.text) {
            components.push({
                type: 'FOOTER',
                text: data.footer.text
            })
        }

        // D. Buttons
        if (data.buttons && data.buttons.length > 0) {
            const validButtons: MetaButton[] = []

            for (const btn of data.buttons) {
                if (btn.type === 'URL') {
                    const url = this.normalizeUrl(btn.url || '')
                    // Check for invalid Naked Variables
                    const nakedVarMatch = url.match(/^\{\{\d+\}\}$/)
                    if (nakedVarMatch) {
                        throw new Error(`URL inválida no botão "${btn.text}". Domínio obrigatório (ex: https://site.com/{{1}}).`)
                    }

                    const metaBtn: MetaButton = {
                        type: 'URL',
                        text: btn.text,
                        url: url
                    }

                    // If URL has variable, add example
                    if (url.includes('{{1}}')) {
                        metaBtn.example = ['https://exemplo.com/detalhe']
                    }
                    validButtons.push(metaBtn)

                } else if (btn.type === 'PHONE_NUMBER') {
                    validButtons.push({
                        type: 'PHONE_NUMBER',
                        text: btn.text,
                        phone_number: btn.phone_number
                    })
                } else if (btn.type === 'QUICK_REPLY') {
                    validButtons.push({
                        type: 'QUICK_REPLY',
                        text: btn.text
                    })
                } else if (btn.type === 'COPY_CODE') {
                    const exampleValue = btn.example
                        ? (Array.isArray(btn.example) ? btn.example : [btn.example])
                        : ['CODE123']
                    validButtons.push({
                        type: 'COPY_CODE',
                        example: exampleValue
                    })
                }
            }

            if (validButtons.length > 0) {
                components.push({
                    type: 'BUTTONS',
                    buttons: validButtons
                })
            }
        }

        // E. Carousel
        if (data.carousel && data.carousel.cards && data.carousel.cards.length > 0) {
            const carouselComponent: MetaCarouselComponent = {
                type: 'CAROUSEL',
                cards: data.carousel.cards as any
            }
            components.push(carouselComponent)
        }

        // F. Limited Time Offer
        if (data.limited_time_offer) {
            components.push({
                type: 'LIMITED_TIME_OFFER',
                limited_time_offer: data.limited_time_offer
            })
        }

        return {
            name: data.name,
            language: data.language,
            category: data.category,
            components: components
        }
    }

    private normalizeUrl(url: string): string {
        if (!url) return ''
        let processed = url.trim()
        if (!processed.startsWith('http://') && !processed.startsWith('https://')) {
            processed = 'https://' + processed
        }
        processed = processed.replace(/\{\{\d+\}\}/g, '{{1}}')
        return processed
    }

    private extractVariables(text: string): number {
        const matches = text.match(/\{\{(\d+)\}\}/g) || []
        if (matches.length === 0) return 0
        const uniqueNumbers = new Set(matches.map(m => parseInt(m.replace(/\{\{|\}\}/g, ''), 10)))
        return uniqueNumbers.size
    }

    private renumberVariables(text: string): string {
        const allMatches = text.match(/\{\{([^}]+)\}\}/g) || []
        if (allMatches.length === 0) return text

        const seen = new Set<string>()
        const uniqueVars: string[] = []
        for (const match of allMatches) {
            const varName = match.replace(/\{\{|\}\}/g, '')
            if (!seen.has(varName)) {
                seen.add(varName)
                uniqueVars.push(varName)
            }
        }

        const mapping: Record<string, number> = {}
        uniqueVars.forEach((varName, idx) => {
            mapping[varName] = idx + 1
        })

        let result = text
        const sortedVars = Object.keys(mapping).sort((a, b) => b.length - a.length)
        for (const oldVar of sortedVars) {
            const newNum = mapping[oldVar]
            result = result.replaceAll(`{{${oldVar}}}`, `{{${newNum}}}`)
        }
        return result
    }
}

export const templateService = new TemplateService()
