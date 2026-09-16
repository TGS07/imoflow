import { createServiceClient } from '@/lib/supabase/service'
import { getPortalData } from '@/lib/portal/get-portal-data'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_ACTIONS = ['favorite', 'request_visit'] as const

// Portal de cliente: sem sessão — o portal_token na URL É a autenticação,
// mesmo padrão de GET /api/feed/[token] e GET /api/calendar/[token]. Esta
// rota devolve JSON (é consumida pelo nosso próprio componente cliente),
// ao contrário do feed XML que devolve texto simples em caso de erro.
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const data = await getPortalData(supabase, token)
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fire-and-forget: um falhanço a registar a visualização não deve
  // impedir a resposta ao cliente.
  supabase
    .from('portal_views')
    .insert({ lead_id: data.lead_id, action: 'view' })
    .then(({ error }) => {
      if (error) console.error('[portal] failed to log view', error)
    })

  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const action = body?.action
  const propertyId: string | undefined = body?.property_id

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, agency_id')
    .eq('portal_token', token)
    .maybeSingle()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Defesa em profundidade: um cliente malicioso podia tentar registar ações
  // contra o property_id de outra agência — validamos que a propriedade
  // pertence mesmo à agência deste lead.
  if (propertyId) {
    const { data: property } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('agency_id', lead.agency_id)
      .maybeSingle()

    if (!property) {
      return NextResponse.json({ error: 'Imóvel inválido' }, { status: 400 })
    }
  }

  const { error: insertError } = await supabase
    .from('portal_views')
    .insert({ lead_id: lead.id, property_id: propertyId ?? null, action })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
