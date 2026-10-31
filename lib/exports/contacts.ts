import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export const NO_TEMPERATURE = 'sem'
export const TEMPERATURE_FILTERS = ['frio', 'fresco', 'morno', 'quente', NO_TEMPERATURE] as const

export type ExportFilters = {
  pipelineIds: string[]
  stageIds: string[]
  temperature: string | null
}

export type ExportViewer = {
  userId: string
  agencyId: string
  role: string
}

export type ExportRow = {
  key: string
  name: string
  phone: string | null
  email: string | null
  pipeline: string
  stage: string
  temperature: string | null
  consultant: string | null
  property: string | null
  lastContactAt: string | null
}

type LeadRow = {
  id: string
  person_id: string | null
  pipeline_id: string | null
  name: string
  email: string | null
  phone: string | null
  users: { name: string } | null
  pipeline_stages: { name: string; pipeline_id: string } | null
  pipelines: { name: string } | null
  people: { name: string; email: string | null; phone: string | null; temperature: string | null } | null
  properties: { reference: string | null; title: string | null } | null
}

const LEAD_SELECT = 'id, person_id, pipeline_id, name, email, phone, users(name), pipeline_stages(name, pipeline_id), pipelines(name), people(name, email, phone, temperature), properties(reference, title)'
const PAGE_SIZE = 1000
const CHUNK_SIZE = 200

// O Supabase devolve no máximo 1000 linhas por query. Mais recentes primeiro:
// é a lead mais recente que representa o contacto quando há repetidos.
async function fetchLeads(supabase: Supabase, viewer: ExportViewer, filters: ExportFilters): Promise<LeadRow[]> {
  const leads: LeadRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('leads')
      .select(LEAD_SELECT)
      .eq('agency_id', viewer.agencyId)
      .in('pipeline_id', filters.pipelineIds)
      .in('stage_id', filters.stageIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (viewer.role === 'agent') query = query.eq('assigned_to', viewer.userId)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    // Há leads com a fase de outra pipeline: o quadro não as mostra em nenhuma
    // coluna, por isso também ficam de fora daqui.
    leads.push(...(data as unknown as LeadRow[]).filter(l => l.pipeline_stages?.pipeline_id === l.pipeline_id))
    if (data.length < PAGE_SIZE) return leads
  }
}

// Só chamadas atendidas contam como contacto, a mesma regra da contagem de
// dias desde o último contacto.
async function fetchLastContacts(supabase: Supabase, personIds: string[]): Promise<Map<string, string>> {
  const lastContacts = new Map<string, string>()
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('contact_interactions')
      .select('person_id, created_at')
      .eq('type', 'chamada')
      .eq('outcome', 'atendeu')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    for (const c of data) {
      if (!lastContacts.has(c.person_id)) lastContacts.set(c.person_id, c.created_at)
    }
  }
  return lastContacts
}

function propertyLabel(property: LeadRow['properties']): string | null {
  if (!property) return null
  return [property.reference, property.title].filter(Boolean).join(' — ') || null
}

function distinctNames(names: (string | undefined)[]): string {
  return [...new Set(names.filter(Boolean))].join(', ')
}

export async function loadExportRows(supabase: Supabase, viewer: ExportViewer, filters: ExportFilters): Promise<ExportRow[]> {
  const leads = await fetchLeads(supabase, viewer, filters)

  const byKey = new Map<string, LeadRow[]>()
  for (const lead of leads) {
    const key = lead.person_id ? `p:${lead.person_id}` : `l:${lead.id}`
    byKey.set(key, [...(byKey.get(key) ?? []), lead])
  }

  const personIds = [...byKey.values()].map(group => group[0].person_id).filter((v): v is string => !!v)
  const lastContacts = await fetchLastContacts(supabase, personIds)

  // Uma linha por contacto: a lead mais recente dá o consultor e o imóvel, e
  // Pipeline e Fase mostram todas as escolhidas onde o contacto está.
  const rows = [...byKey.entries()].map(([key, group]): ExportRow => {
    const lead = group[0]
    return {
      key,
      name: lead.people?.name || lead.name,
      phone: lead.people?.phone || lead.phone,
      email: lead.people?.email || lead.email,
      pipeline: distinctNames(group.map(l => l.pipelines?.name)),
      stage: distinctNames(group.map(l => l.pipeline_stages?.name)),
      temperature: lead.people?.temperature ?? null,
      consultant: lead.users?.name ?? null,
      property: propertyLabel(lead.properties),
      lastContactAt: lead.person_id ? lastContacts.get(lead.person_id) ?? null : null,
    }
  })

  return rows
    .filter(row => {
      if (!filters.temperature) return true
      if (filters.temperature === NO_TEMPERATURE) return !row.temperature
      return row.temperature === filters.temperature
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}
