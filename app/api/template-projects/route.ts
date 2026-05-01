import { NextResponse } from 'next/server'
import { templateProjectDb } from '@/lib/supabase-db'
import { getCurrentUser } from '@/lib/clerk-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const user = await getCurrentUser()
        const orgId = user?.organizationId || null
        const projects = await templateProjectDb.getAll(orgId ?? undefined)
        return NextResponse.json(projects)
    } catch (error) {
        console.error('Failed to fetch template projects:', error)
        return NextResponse.json(
            { error: 'Failed to fetch template projects' },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser()
        const orgId = user?.organizationId || null
        const body = await request.json();
        console.log('[API CREATE PROJECT] Body Items:', JSON.stringify(body.items?.map((i: any) => ({ name: i.name, category: i.category })), null, 2));

        const project = await templateProjectDb.create(body, orgId ?? undefined);
        return NextResponse.json(project)
    } catch (error) {
        console.error('Failed to create template project:', error)
        return NextResponse.json(
            { error: 'Failed to create template project' },
            { status: 500 }
        )
    }
}
