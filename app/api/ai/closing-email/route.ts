import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import { buildClosingEmailPrompt } from '@/lib/ai/prompts'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { property_id } = await request.json() as { property_id: string }
  if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 })

  const [{ data: profile }, { data: property }, { data: agency }] = await Promise.all([
    supabase.from('users').select('name').eq('id', user.id).single(),
    supabase.from('properties').select('title, seller_id, seller:people!seller_id(name)').eq('id', property_id).single(),
    supabase.from('agencies').select('name').single(),
  ])
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // contactos envolvidos: vendedor + compradores das leads ligadas ao imóvel + visitas ligadas
  const [{ data: leads }, { data: visits }] = await Promise.all([
    supabase.from('leads').select('people(name)').eq('property_id', property_id),
    supabase.from('property_visits').select('people(name)').eq('property_id', property_id),
  ])
  const names = new Set<string>()
  const sellerName = (property as { seller?: { name?: string } | null }).seller?.name
  if (sellerName) names.add(sellerName)
  for (const l of leads ?? []) { const n = (l as { people?: { name?: string } }).people?.name; if (n) names.add(n) }
  for (const v of visits ?? []) { const n = (v as { people?: { name?: string } }).people?.name; if (n) names.add(n) }

  const prompt = buildClosingEmailPrompt({
    propertyTitle: property.title,
    contactNames: [...names].length ? [...names] : ['Cliente'],
    agentName: profile?.name ?? 'Agente',
    agencyName: agency?.name ?? 'Agência',
    reviewLink: process.env.GOOGLE_REVIEW_LINK ?? 'https://g.page/r/CONFIGURAR-REVIEW',
  })

  const completion = await getAIClient().chat.completions.create({
    model: AI_MODEL, max_tokens: 512, temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  })
  return NextResponse.json({ body: completion.choices[0]?.message?.content?.trim() ?? '', recipients: [...names] })
}
