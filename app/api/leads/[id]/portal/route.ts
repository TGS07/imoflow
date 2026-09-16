import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAuthorizedLead(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null, lead: null, errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { supabase, profile: null, lead: null, errorResponse: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }

  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, agency_id, portal_token')
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .single()

  if (error || !lead) return { supabase, profile, lead: null, errorResponse: NextResponse.json({ error: 'Lead not found' }, { status: 404 }) }

  return { supabase, profile, lead, errorResponse: null }
}

function portalUrl(request: Request, token: string) {
  const origin = new URL(request.url).origin
  return `${origin}/portal/${token}`
}

// GET: estado do portal do lead + histórico de atividade (visualizações,
// favoritos, pedidos de visita) para o agente acompanhar.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, lead, errorResponse } = await getAuthorizedLead(id)
  if (errorResponse) return errorResponse

  const { data: activity, error } = await supabase
    .from('portal_views')
    .select('id, action, created_at, property_id, properties(title)')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    portal_token: lead!.portal_token,
    portal_url: lead!.portal_token ? portalUrl(request, lead!.portal_token) : null,
    activity: activity ?? [],
  })
}

// POST: ativa o portal (gera um token só se ainda não existir) ou, com
// { regenerate: true }, substitui sempre o token — invalidando o link
// anterior. Mesmo padrão de confirmação/regeneração do feed_token da agência.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, lead, errorResponse } = await getAuthorizedLead(id)
  if (errorResponse) return errorResponse

  const body = await request.json().catch(() => ({}))
  const regenerate = body?.regenerate === true

  let token = lead!.portal_token
  if (!token || regenerate) {
    token = randomUUID()
    const { error } = await supabase
      .from('leads')
      .update({ portal_token: token })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ portal_token: token, portal_url: portalUrl(request, token) })
}
