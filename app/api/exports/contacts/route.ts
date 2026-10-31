import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildContactsWorkbook } from '@/lib/exports/build-workbook'
import { loadExportRows, TEMPERATURE_FILTERS, type ExportFilters } from '@/lib/exports/contacts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(id => typeof id === 'string' && UUID.test(id))
}

function parseFilters(pipelineIds: unknown, stageIds: unknown, temperature: unknown): ExportFilters | null {
  if (!isIdList(pipelineIds) || !isIdList(stageIds)) return null
  if (temperature && !(TEMPERATURE_FILTERS as readonly unknown[]).includes(temperature)) return null
  return { pipelineIds: [...new Set(pipelineIds)], stageIds, temperature: temperature ? String(temperature) : null }
}

// Sessão, perfil e pipelines da própria agência: comum à pré-visualização e ao ficheiro.
async function authorize(pipelineIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { failure: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('users')
    .select('role, agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { failure: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name')
    .in('id', pipelineIds)
    .eq('agency_id', profile.agency_id)
  if (pipelines?.length !== pipelineIds.length) return { failure: NextResponse.json({ error: 'Pipeline inválida' }, { status: 404 }) }

  return { supabase, pipelines, viewer: { userId: user.id, agencyId: profile.agency_id, role: profile.role } }
}

function exportFileName(pipelineNames: string[]): string {
  const name = pipelineNames.length === 1 ? pipelineNames[0] : 'varias pipelines'
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  return `contactos-${slug || 'pipeline'}-${today}.xlsx`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filters = parseFilters(
    searchParams.get('pipeline_ids')?.split(',').filter(Boolean),
    searchParams.get('stage_ids')?.split(',').filter(Boolean),
    searchParams.get('temperature'),
  )
  if (!filters) return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })

  const auth = await authorize(filters.pipelineIds)
  if (auth.failure) return auth.failure

  try {
    return NextResponse.json(await loadExportRows(auth.supabase, auth.viewer, filters))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao carregar contactos' }, { status: 500 })
  }
}

// As linhas são recarregadas pelos filtros e só depois cortadas pelas chaves
// escolhidas: o cliente não consegue pedir contactos que não possa ver, e quem
// entrou na fase depois da pré-visualização não sai sem ser visto.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const filters = parseFilters(body.pipeline_ids, body.stage_ids, body.temperature)
  const selectedKeys = Array.isArray(body.selected_keys) ? new Set(body.selected_keys) : new Set()
  if (!filters || selectedKeys.size === 0) return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })

  const auth = await authorize(filters.pipelineIds)
  if (auth.failure) return auth.failure

  try {
    const rows = await loadExportRows(auth.supabase, auth.viewer, filters)
    const file = await buildContactsWorkbook(rows.filter(r => selectedKeys.has(r.key)))
    return new Response(file, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${exportFileName(auth.pipelines.map(p => p.name))}"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao gerar o ficheiro' }, { status: 500 })
  }
}
