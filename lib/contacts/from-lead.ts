// lib/contacts/from-lead.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { budgetToCapacity } from '@/lib/contacts/constants'

type LeadLike = {
  id: string; agency_id: string; name: string; email?: string | null; phone?: string | null
  source?: string | null; budget?: number | null; zone?: string | null; typology?: string | null
  notes?: string | null; person_id?: string | null
}

// Cria (ou atualiza) o contacto ligado a uma lead. Idealista => comprador.
// Devolve o person_id.
export async function ensureContactForLead(lead: LeadLike, supabase: SupabaseClient): Promise<string | null> {
  const source = (lead.source ?? 'outro')
  const details = {
    looking_for: lead.typology || lead.notes || undefined,
    search_zone: lead.zone || undefined,
  }
  const capacity = budgetToCapacity(lead.budget)

  if (lead.person_id) {
    // enriquecer sem sobrepor dados existentes: só preencher o que estiver vazio
    const { data: existing } = await supabase.from('people').select('types, financial_capacity, details, source').eq('id', lead.person_id).single()
    if (existing) {
      const types = new Set<string>([...(existing.types ?? []), 'comprador'])
      await supabase.from('people').update({
        types: [...types],
        financial_capacity: existing.financial_capacity ?? capacity,
        source: existing.source ?? source,
        details: { ...details, ...(existing.details ?? {}) },
      }).eq('id', lead.person_id)
    }
    return lead.person_id
  }

  const { data: created, error } = await supabase.from('people').insert({
    agency_id: lead.agency_id,
    name: lead.name, email: lead.email || null, phone: lead.phone || null,
    types: ['comprador'], financial_capacity: capacity, source,
    details,
  }).select('id').single()
  if (error) return null
  return created.id
}
