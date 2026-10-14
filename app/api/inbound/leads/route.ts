import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications'
import { triggerAutomations } from '@/lib/automations/engine'
import { normalizePhone } from '@/lib/whatsapp/utils'
import { parseInboundLead, mapLeadSource, buildLeadNotes } from '@/lib/inbound/parse-lead'

// Entrada de leads de parceiros (formulários do Instagram, sites, Make,
// Zapier…). Autenticação pela chave de uma ligação criada em
// Definições → Integrações. Aceita JSON, form-urlencoded ou multipart.
//
//   POST /api/inbound/leads
//   Authorization: Bearer <chave>   (ou cabeçalho x-api-key, ou ?key=<chave>)
//   { "name": "...", "phone": "...", "email": "...", "message": "...", "source": "instagram" }

type Webhook = {
  id: string
  agency_id: string
  name: string
  pipeline_id: string | null
  stage_id: string | null
  assigned_to: string | null
  is_active: boolean
  lead_count: number
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS })
}

// Limite por chave (best-effort, por instância): protege de loops do parceiro
const RATE_LIMIT = 300
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

function readKey(request: Request): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  const header = request.headers.get('x-api-key')
  if (header) return header.trim()
  return new URL(request.url).searchParams.get('key')
}

async function findWebhook(key: string | null): Promise<Webhook | null> {
  if (!key || key.length < 20 || key.length > 200) return null
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('lead_webhooks')
    .select('id, agency_id, name, pipeline_id, stage_id, assigned_to, is_active, lead_count')
    .eq('token', key)
    .maybeSingle()
  return data && data.is_active ? (data as Webhook) : null
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const type = request.headers.get('content-type') ?? ''
  try {
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      const form = await request.formData()
      const out: Record<string, unknown> = {}
      form.forEach((v, k) => { if (typeof v === 'string') out[k] = v })
      return out
    }
    const text = await request.text()
    if (!text.trim()) return {}
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const last9 = (phone: string | null | undefined) => (phone ?? '').replace(/\D/g, '').slice(-9)

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// Testar a ligação: GET com a chave devolve o nome da ligação
export async function GET(request: Request) {
  const webhook = await findWebhook(readKey(request))
  if (!webhook) return json({ ok: false, error: 'Chave inválida ou ligação desativada.' }, 401)
  return json({ ok: true, connection: webhook.name, message: 'Ligação ativa. Envie as leads com POST para este endereço.' })
}

export async function POST(request: Request) {
  const key = readKey(request)
  const webhook = await findWebhook(key)
  if (!webhook) return json({ success: false, error: 'Chave inválida ou ligação desativada.' }, 401)
  if (!checkRateLimit(webhook.id)) return json({ success: false, error: 'Demasiados pedidos. Tente mais tarde.' }, 429)

  const body = await readBody(request)
  if (!body) return json({ success: false, error: 'Corpo inválido. Envie JSON ou um formulário.' }, 400)

  const lead = parseInboundLead(body)
  if (!lead.phone && !lead.email) {
    return json({ success: false, error: 'É preciso pelo menos telefone ou email.' }, 422)
  }
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) lead.email = null
  if (!lead.phone && !lead.email) return json({ success: false, error: 'Email inválido.' }, 422)

  const supabase = createServiceClient()
  const agencyId = webhook.agency_id
  const phone = lead.phone ? normalizePhone(lead.phone) : null
  const name = lead.name ?? lead.email ?? (lead.phone as string)
  const notes = buildLeadNotes(lead, webhook.name)

  // Fase de destino: a escolhida na ligação, ou a 1ª da pipeline escolhida,
  // ou a 1ª pipeline da agência (resolvida aqui para a verificação de duplicados)
  let stageId = webhook.stage_id
  let pipelineId = webhook.pipeline_id
  if (stageId) {
    const { data: stage } = await supabase.from('pipeline_stages').select('pipeline_id').eq('id', stageId).maybeSingle()
    if (stage) pipelineId = stage.pipeline_id
    else stageId = null
  }
  if (!pipelineId) {
    const { data: first } = await supabase.from('pipelines').select('id').eq('agency_id', agencyId).order('position').limit(1).maybeSingle()
    pipelineId = first?.id ?? null
  }
  if (!stageId && pipelineId) {
    const { data: first } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', pipelineId).order('position').limit(1).maybeSingle()
    stageId = first?.id ?? null
  }

  // Contacto já existe? (mesmo email, ou mesmo número pelos últimos 9 dígitos)
  let person: { id: string; assigned_to: string | null } | null = null
  {
    const { data: candidates } = await supabase
      .from('people')
      .select('id, phone, email, assigned_to')
      .eq('agency_id', agencyId)
      .or([lead.email ? `email.ilike.${lead.email.replace(/[%_,()]/g, '')}` : null, phone ? 'phone.not.is.null' : null].filter(Boolean).join(','))
    const target9 = last9(phone)
    person = (candidates ?? []).find(p =>
      (lead.email && p.email?.toLowerCase() === lead.email) || (target9.length === 9 && last9(p.phone) === target9)
    ) ?? null
  }

  // Admin para notificar quando não há responsável
  const { data: admin } = await supabase.from('users').select('id').eq('agency_id', agencyId).eq('role', 'admin').order('created_at').limit(1).maybeSingle()
  const assignedTo = webhook.assigned_to ?? person?.assigned_to ?? null
  const notifyUserId = assignedTo ?? admin?.id ?? null

  // Já está nesta pipeline num negócio ativo → não duplicar o card: regista
  // o novo pedido no historial do contacto.
  if (person && pipelineId) {
    const { data: existing } = await supabase
      .from('leads')
      .select('id, pipeline_stages!inner(is_won, is_lost)')
      .eq('person_id', person.id)
      .eq('pipeline_id', pipelineId)
      .eq('pipeline_stages.is_won', false)
      .eq('pipeline_stages.is_lost', false)
      .limit(1)
      .maybeSingle()
    if (existing) {
      await supabase.from('contact_interactions').insert({
        agency_id: agencyId, person_id: person.id, user_id: null, type: 'nota',
        note: `Novo pedido recebido. ${notes}`.slice(0, 4000),
      })
      await supabase.from('people').update({ last_interaction_at: new Date().toISOString() }).eq('id', person.id)
      await supabase.from('lead_webhooks').update({ last_used_at: new Date().toISOString() }).eq('id', webhook.id)
      if (notifyUserId) {
        await createNotification({
          userId: notifyUserId, agencyId, type: 'new_lead',
          title: `Novo pedido de ${name}`,
          body: `${name} voltou a pedir contacto (via ${webhook.name}). Já está na pipeline.`,
          link: `/leads/${existing.id}`,
        }, supabase)
      }
      return json({ success: true, duplicate: true, lead_id: existing.id })
    }
  }

  const { data: inserted, error } = await supabase
    .from('leads')
    .insert({
      agency_id: agencyId,
      person_id: person?.id ?? null, // sem contacto, o trigger leads_ensure_contact cria um
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo,
      name,
      email: lead.email,
      phone,
      source: mapLeadSource(lead.source),
      zone: lead.zone,
      typology: lead.typology,
      budget: lead.budget,
      notes,
    })
    .select('id, pipeline_id')
    .single()

  if (error || !inserted) {
    console.error('[inbound-leads] insert failed', { webhook: webhook.id, error: error?.message })
    return json({ success: false, error: 'Erro ao guardar a lead. Tente novamente.' }, 500)
  }

  await supabase
    .from('lead_webhooks')
    .update({ lead_count: webhook.lead_count + 1, last_used_at: new Date().toISOString() })
    .eq('id', webhook.id)

  if (notifyUserId) {
    await createNotification({
      userId: notifyUserId, agencyId, type: 'new_lead',
      title: `Nova lead: ${name}`,
      body: `Chegou via ${webhook.name}.${phone ? ` Telefone: ${lead.phone}` : ''}`,
      link: `/leads/${inserted.id}`,
    }, supabase)

    await triggerAutomations({
      type: 'lead_created',
      leadId: inserted.id,
      userId: notifyUserId,
      agencyId,
      meta: { pipelineId: inserted.pipeline_id ?? undefined },
    }, supabase).catch(err => console.error('[inbound-leads] automations', err))
  }

  return json({ success: true, lead_id: inserted.id }, 201)
}
