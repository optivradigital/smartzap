import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getRequestOrgId } from '@/lib/org-context'

/**
 * API Route: Test Contact Settings (per-org)
 *
 * Persists the test contact (name + phone) in Supabase settings table,
 * scoped per organization via key = `test_contact_{orgId}`.
 */

function settingKey(orgId: string): string {
  return `test_contact_${orgId}`
}

export async function GET() {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const key = settingKey(orgId)
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error
    }

    if (data?.value) {
      const parsed = typeof data.value === 'string'
        ? JSON.parse(data.value)
        : data.value
      return NextResponse.json(parsed)
    }

    return NextResponse.json(null)
  } catch (error) {
    console.error('Error fetching test contact:', error)
    return NextResponse.json(
      { error: 'Failed to fetch test contact' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { name, phone } = body

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const normalizedPhone = phone.replace(/[^\d+]/g, '')

    const testContact = {
      name: name?.trim() || '',
      phone: normalizedPhone,
      updatedAt: new Date().toISOString()
    }

    const { error } = await supabase
      .from('settings')
      .upsert({
        key: settingKey(orgId),
        value: JSON.stringify(testContact)
      }, {
        onConflict: 'key'
      })

    if (error) throw error

    return NextResponse.json({ success: true, testContact })
  } catch (error) {
    console.error('Error saving test contact:', error)
    return NextResponse.json(
      { error: 'Failed to save test contact' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { error } = await supabase
      .from('settings')
      .delete()
      .eq('key', settingKey(orgId))

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting test contact:', error)
    return NextResponse.json(
      { error: 'Failed to delete test contact' },
      { status: 500 }
    )
  }
}
