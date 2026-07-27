import type { SupabaseClient } from '@supabase/supabase-js'

export type ContactPropertyCandidate = {
  id: string
  reference: string | null
  title: string
  zone: string | null
  typology: string | null
  price: number | null
}

// Imóveis já associados a uma pessoa como vendedora, compradora candidata ou
// consultora — candidatos a ligar ao criar um card de pipeline para ela.
// Espelha os mesmos três joins já usados em GET /api/people/[id].
export async function resolveContactPropertyCandidates(
  supabase: SupabaseClient,
  agencyId: string,
  personId: string
): Promise<ContactPropertyCandidate[]> {
  const { data } = await supabase
    .from('people')
    .select(`
      properties_as_seller:properties!seller_id(id, reference, title, zone, typology, price),
      properties_as_buyer:properties!buyer_id(id, reference, title, zone, typology, price),
      property_consultants(properties(id, reference, title, zone, typology, price))
    `)
    .eq('id', personId)
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (!data) return []
  const seller = (data.properties_as_seller ?? []) as ContactPropertyCandidate[]
  const buyer = (data.properties_as_buyer ?? []) as ContactPropertyCandidate[]
  const consultant = ((data.property_consultants ?? []) as unknown as { properties: ContactPropertyCandidate | null }[])
    .map(pc => pc.properties)
    .filter((p): p is ContactPropertyCandidate => !!p)

  const byId = new Map<string, ContactPropertyCandidate>()
  for (const p of [...seller, ...buyer, ...consultant]) byId.set(p.id, p)
  return [...byId.values()]
}
