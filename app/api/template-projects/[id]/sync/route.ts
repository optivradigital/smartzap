
import { NextResponse } from 'next/server'
import { templateProjectDb } from '@/lib/supabase-db'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { requireManager } from '@/lib/role-guard'

export const dynamic = 'force-dynamic'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error: authError, user } = await requireManager()
        if (authError) return authError
        const orgId = user.organizationId || null

        const { id } = await params
        const project = await templateProjectDb.getById(id)
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        const credentials = await getWhatsAppCredentials(orgId)
        if (!credentials) {
            return NextResponse.json({ error: 'WhatsApp credentials not found' }, { status: 500 })
        }

        const results = []

        for (const item of project.items) {
            try {
                let metaData = null

                // Strategy 1: Sync by ID
                if (item.meta_id) {
                    const response = await fetch(
                        `https://graph.facebook.com/v24.0/${item.meta_id}?fields=status,name,id`,
                        { headers: { 'Authorization': `Bearer ${credentials.accessToken}` } }
                    )
                    if (response.ok) {
                        metaData = await response.json()
                    }
                }

                // Strategy 2: Sync by Name (Recovery) if ID failed or missing
                if (!metaData && item.name) {
                    const response = await fetch(
                        `https://graph.facebook.com/v24.0/${credentials.businessAccountId}/message_templates?name=${item.name}&fields=status,name,id`,
                        { headers: { 'Authorization': `Bearer ${credentials.accessToken}` } }
                    )

                    if (response.ok) {
                        const data = await response.json()
                        if (data.data && data.data.length > 0) {
                            // Find exact match (just to be safe)
                            metaData = data.data.find((t: any) => t.name === item.name) || data.data[0]
                        }
                    }
                }

                // Update DB if we found data
                if (metaData) {
                    await templateProjectDb.updateItem(item.id, {
                        meta_id: metaData.id,
                        meta_status: metaData.status
                    })

                    results.push({ id: item.id, status: 'updated', meta: metaData })
                } else {
                    // Not found in Meta -> Reset to Draft so user can try again
                    await templateProjectDb.updateItem(item.id, {
                        meta_id: undefined,
                        meta_status: undefined
                    })
                    results.push({ id: item.id, status: 'reset_to_draft' })
                }

            } catch (err) {
                console.error(`Sync error for item ${item.name}:`, err)
                results.push({ id: item.id, status: 'error' })
            }
        }

        return NextResponse.json({ success: true, results })

    } catch (error) {
        console.error('Sync Project Error:', error)
        return NextResponse.json(
            { error: 'Failed to sync project' },
            { status: 500 }
        )
    }
}
