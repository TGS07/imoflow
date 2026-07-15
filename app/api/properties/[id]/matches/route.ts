// GET /api/properties/[id]/matches — compradores/investidores compatíveis
// com este imóvel (capacidade financeira vs preço, zona, tipologia).
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CAPACITY_BANDS, capacityMeta } from '@/lib/contacts/constants'
import type { Person } from '@/types'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, title, price, zone, city, typology, type')
    .eq('id', id)
    .single()
  if (propError || !property) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: buyers } = await supabase
    .from('people')
    .select('id, name, phone, email, types, financial_capacity, details, is_regular')
    .overlaps('types', ['comprador', 'investidor'])

  const propZones = [property.zone, property.city].filter(Boolean).map(z => norm(z as string))
  const propTypology = property.typology ? norm(property.typology) : null
  const propType = norm(property.type)

  const matches = (buyers ?? []).map(p => {
    const person = p as unknown as Person
    let score = 0
    const reasons: string[] = []
    const details = person.details ?? {}

    // Capacidade financeira cobre o preço
    if (person.financial_capacity && property.price) {
      const band = CAPACITY_BANDS.find(b => b.key === person.financial_capacity)
      if (band && property.price <= band.max) {
        score += 2
        reasons.push(`Capacidade: ${capacityMeta(person.financial_capacity)?.label}`)
      }
    }

    // Zona de procura bate com zona/cidade do imóvel
    const searchZone = details.search_zone ? norm(details.search_zone) : null
    if (searchZone && propZones.some(z => z.includes(searchZone) || searchZone.includes(z))) {
      score += 2
      reasons.push(`Zona: ${details.search_zone}`)
    }

    // O que procura bate com tipologia/tipo do imóvel
    const looking = [details.looking_for, details.typology].filter(Boolean).map(s => norm(s as string)).join(' ')
    if (looking && ((propTypology && looking.includes(propTypology)) || looking.includes(propType))) {
      score += 1
      reasons.push('Procura compatível')
    }

    // Contacto regular (acompanhado de perto) vale pontos
    if (person.is_regular) {
      score += 1
      reasons.push('Contacto regular')
    }

    return { id: person.id, name: person.name, phone: person.phone, email: person.email, types: person.types, score, reasons }
  })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return NextResponse.json({ property: { id: property.id, title: property.title, price: property.price }, matches })
}
