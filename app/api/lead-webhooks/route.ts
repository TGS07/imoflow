import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateWebhookToken } from '@/lib/inbound/token'
import { createServiceClient } from '@/lib/supabase/service'

// Ligações externas de leads (Definições → Integrações). Apenas admin; a RLS
// da tabela também só deixa administradores da agência ler/escrever.

async function adminProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('users').select('agency_id, role').eq('id', user.id).single()
  if (!profile) return { supabase, error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  if (profile.role !== 'admin') return { supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { supabase, profile }
}

export async function GET() {
  const { supabase, profile, error } = await adminProfile()
  if (error) return error
  const { data, error: dbError } = await supabase
    .from('lead_webhooks')
    .select('*, pipelines(name), pipeline_stages(name), users(name)')
    .eq('agency_id', profile.agency_id)
    .order('created_at', { ascending: true })
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Contas com quem cada ligação divide as leads. Estão noutras agências (a RLS
  // não as mostra), por isso lê-se com a service role — só nome e contagens,
  // nunca a chave.
  const groups = [...new Set((data ?? []).map(w => w.split_group).filter((g): g is string => !!g))]
  const membersByGroup = new Map<string, { id: string; name: string; agency: string; lead_count: number; is_active: boolean }[]>()
  if (groups.length) {
    const { data: members } = await createServiceClient()
      .from('lead_webhooks')
      .select('id, name, split_group, lead_count, is_active, agencies(name)')
      .in('split_group', groups)
      .order('created_at')
    for (const m of members ?? []) {
      const list = membersByGroup.get(m.split_group) ?? []
      list.push({ id: m.id, name: m.name, agency: (m.agencies as unknown as { name: string } | null)?.name ?? '—', lead_count: m.lead_count, is_active: m.is_active })
      membersByGroup.set(m.split_group, list)
    }
  }

  return NextResponse.json((data ?? []).map(w => ({
    ...w,
    split_members: w.split_group ? (membersByGroup.get(w.split_group) ?? []).filter(m => m.id !== w.id) : [],
  })))
}

export async function POST(request: Request) {
  const { supabase, profile, error } = await adminProfile()
  if (error) return error
  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : ''
  if (!name) return NextResponse.json({ error: 'Dá um nome à ligação (ex: nome do parceiro).' }, { status: 400 })

  const { data, error: dbError } = await supabase
    .from('lead_webhooks')
    .insert({
      agency_id: profile.agency_id,
      name,
      token: generateWebhookToken(),
      pipeline_id: typeof body.pipeline_id === 'string' && body.pipeline_id ? body.pipeline_id : null,
      stage_id: typeof body.stage_id === 'string' && body.stage_id ? body.stage_id : null,
      assigned_to: typeof body.assigned_to === 'string' && body.assigned_to ? body.assigned_to : null,
    })
    .select('*, pipelines(name), pipeline_stages(name), users(name)')
    .single()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
