import { createServiceClient } from '@/lib/supabase/service'
import { generatePropertiesXml, type FeedProperty } from '@/lib/feed/xml-generator'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Feed XML público de imóveis, para importação em portais imobiliários
// (CASA/SAPO). Sem sessão — o token na URL É a autenticação, mesmo padrão
// de GET /api/calendar/[token]. Só disponível a agências no plano Pro
// (verificado aqui, não só na UI de definições).
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // feed_token é uuid — um token mal formado nunca vai corresponder a
  // nenhuma linha; validamos aqui para devolver 404 direto em vez de
  // deixar o Postgres rejeitar o cast (o que devolveria um erro 500).
  if (!UUID_RE.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const supabase = createServiceClient()

  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select('id, name, plan')
    .eq('feed_token', token)
    .maybeSingle()

  if (agencyError) {
    console.error('[properties-feed] agency lookup failed', agencyError)
    return new NextResponse('Internal error', { status: 500 })
  }
  if (!agency) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (agency.plan !== 'pro') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { data: properties, error: propertiesError } = await supabase
    .from('properties')
    .select('id, reference, title, type, status, price, area_m2, typology, bedrooms, bathrooms, description, address, city, zone, postal_code, latitude, longitude, photos')
    .eq('agency_id', agency.id)
    .eq('status', 'disponivel')

  if (propertiesError) {
    console.error('[properties-feed] properties query failed', propertiesError)
    return new NextResponse('Internal error', { status: 500 })
  }

  const xml = generatePropertiesXml((properties ?? []) as FeedProperty[], agency.name)

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
