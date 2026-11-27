import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

// Dividir as leads desta ligação com a ligação de outra conta (alternância).
// A outra conta prova que concorda dando a chave da ligação dela — quem tem a
// chave já podia enviar-lhe leads, por isso isto não abre mais nenhum acesso.

async function ownWebhook(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('users').select('agency_id, role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  // RLS: só devolve se a ligação for desta agência
  const { data: webhook } = await supabase.from('lead_webhooks').select('id, agency_id, split_group').eq('id', id).eq('agency_id', profile.agency_id).maybeSingle()
  if (!webhook) return { error: NextResponse.json({ error: 'Ligação não encontrada' }, { status: 404 }) }
  return { webhook }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { webhook, error } = await ownWebhook(id)
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!key) return NextResponse.json({ error: 'Cola a chave da ligação da outra conta.' }, { status: 400 })

  const service = createServiceClient()
  const { data: other } = await service
    .from('lead_webhooks')
    .select('id, agency_id, split_group, is_active')
    .eq('token', key)
    .maybeSingle()
  if (!other) return NextResponse.json({ error: 'Chave não encontrada. Confirma que copiaste a chave certa.' }, { status: 404 })
  if (other.id === webhook.id) return NextResponse.json({ error: 'Essa é a chave desta mesma ligação.' }, { status: 400 })
  if (other.agency_id === webhook.agency_id) {
    return NextResponse.json({ error: 'Essa ligação é desta mesma conta. Para dividir dentro da conta, usa responsáveis diferentes.' }, { status: 400 })
  }
  if (!other.is_active) return NextResponse.json({ error: 'A ligação da outra conta está desativada.' }, { status: 400 })

  // Junta os dois grupos (qualquer um pode já ter outras contas)
  const group = webhook.split_group ?? other.split_group ?? randomUUID()
  const groups = [webhook.split_group, other.split_group].filter((g): g is string => !!g && g !== group)
  const ids = [webhook.id, other.id]
  const { error: e1 } = await service.from('lead_webhooks').update({ split_group: group }).in('id', ids)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (groups.length) await service.from('lead_webhooks').update({ split_group: group }).in('split_group', groups)

  return NextResponse.json({ success: true, split_group: group })
}

// Deixar de dividir: esta ligação sai do grupo; se só sobrar uma, o grupo acaba.
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { webhook, error } = await ownWebhook(id)
  if (error) return error
  if (!webhook.split_group) return NextResponse.json({ success: true })

  const service = createServiceClient()
  await service.from('lead_webhooks').update({ split_group: null }).eq('id', webhook.id)
  const { data: rest } = await service.from('lead_webhooks').select('id').eq('split_group', webhook.split_group)
  if ((rest ?? []).length <= 1) {
    await service.from('lead_webhooks').update({ split_group: null }).eq('split_group', webhook.split_group)
  }
  return NextResponse.json({ success: true })
}
