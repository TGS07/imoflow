// GET /api/properties/[id]/consultants — consultores imobiliários de outras
// agências cuja zona de atuação bate com a zona/cidade deste imóvel.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
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
    .select('id, zone, city')
    .eq('id', id)
    .single()
  if (propError || !property) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: consultants } = await supabase
    .from('people')
    .select('id, name, phone, email, types, details')
    .contains('types', ['consultor'])

  const propZones = [property.zone, property.city].filter(Boolean).map(z => norm(z as string))
  if (propZones.length === 0) {
    return NextResponse.json({ consultants: [] })
  }

  const matches = (consultants ?? [])
    .map(p => p as unknown as Person)
    .filter(p => {
      const zone = p.details?.working_zone ? norm(p.details.working_zone) : null
      return zone && propZones.some(z => z.includes(zone) || zone.includes(z))
    })
    .map(p => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      agencyName: p.details?.agency_name ?? null,
      workingZone: p.details?.working_zone ?? null,
    }))
    .slice(0, 10)

  return NextResponse.json({ consultants: matches })
}
