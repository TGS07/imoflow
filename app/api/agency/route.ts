import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isWhatsAppConfigured } from '@/lib/whatsapp/send'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('agencies')
    .select('id, name, email, email_from_name, email_reply_to')
    .eq('id', profile.agency_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, whatsapp_configured: isWhatsAppConfigured() })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { email_from_name?: string | null; email_reply_to?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, string | null> = {}
  if ('email_from_name' in body) {
    updates.email_from_name = body.email_from_name?.trim() || null
  }
  if ('email_reply_to' in body) {
    const replyTo = body.email_reply_to?.trim() || null
    if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
      return NextResponse.json({ error: 'email_reply_to inválido' }, { status: 400 })
    }
    updates.email_reply_to = replyTo
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('agencies')
    .update(updates)
    .eq('id', profile.agency_id)
    .select('id, name, email, email_from_name, email_reply_to')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
