import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Rate limit: 10 submissões por IP por hora (best-effort, sem persistência entre instâncias Vercel)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Demasiadas submissões. Tente mais tarde.' }, { status: 429 })
  }

  const supabase = createServiceClient()

  const { data: form, error: formError } = await supabase
    .from('web_forms')
    .select('id, agency_id, fields, stage_id, is_active')
    .eq('id', formId)
    .single()

  if (formError || !form || !form.is_active) {
    return NextResponse.json({ error: 'Formulário não encontrado.' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
  }
  if (!body.email || typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  }

  // Resolver stage_id: usar o do form ou o primeiro stage da agência
  let stageId: string | null = form.stage_id as string | null
  if (!stageId) {
    const { data: firstStage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('agency_id', form.agency_id)
      .order('position', { ascending: true })
      .limit(1)
      .single()
    if (!firstStage) {
      console.error('[web-form] agency has no pipeline stages', { agencyId: form.agency_id })
      return NextResponse.json({ error: 'Formulário temporariamente indisponível.' }, { status: 500 })
    }
    stageId = firstStage.id
  }

  const fields: string[] = Array.isArray(form.fields) ? (form.fields as string[]) : []

  const leadData: Record<string, unknown> = {
    agency_id: form.agency_id,
    source: 'site',
    stage_id: stageId,
    name: (body.name as string).trim(),
    email: (body.email as string).trim(),
  }

  if (fields.includes('phone') && body.phone) leadData.phone = String(body.phone).trim()
  if (fields.includes('zone') && body.zone) leadData.zone = String(body.zone).trim()
  if (fields.includes('typology') && body.typology) leadData.typology = String(body.typology)
  if (fields.includes('budget') && body.budget) {
    const budgetNum = Number(body.budget)
    if (isNaN(budgetNum)) {
      return NextResponse.json({ error: 'Orçamento deve ser um número.' }, { status: 400 })
    }
    leadData.budget = budgetNum
  }
  if (fields.includes('message') && body.message) leadData.notes = String(body.message).trim()

  const { error: insertError } = await supabase.from('leads').insert(leadData)

  if (insertError) {
    console.error('[web-form] lead insert failed', insertError)
    return NextResponse.json({ error: 'Erro ao guardar os seus dados. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
