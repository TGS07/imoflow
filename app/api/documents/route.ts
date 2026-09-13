import { createClient } from '@/lib/supabase/server'
import { uploadFile } from '@/lib/supabase/storage'
import { NextResponse } from 'next/server'

const BUCKET = 'documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB, matches bucket limit
const SIGNED_URL_TTL = 60 * 60 // 1 hour

const ENTITY_TABLES = {
  lead: 'leads',
  person: 'people',
  property: 'properties',
} as const

type EntityType = keyof typeof ENTITY_TABLES

function isEntityType(value: string | null): value is EntityType {
  return value === 'lead' || value === 'person' || value === 'property'
}

function sanitizeFilename(name: string) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

async function getAuthorizedAgency() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null, errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { supabase, user, profile: null, errorResponse: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }

  return { supabase, user, profile, errorResponse: null }
}

export async function GET(request: Request) {
  const { supabase, profile, errorResponse } = await getAuthorizedAgency()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const entity_type = searchParams.get('entity_type')
  const entity_id = searchParams.get('entity_id')

  if (!isEntityType(entity_type) || !entity_id) {
    return NextResponse.json({ error: 'entity_type e entity_id são obrigatórios' }, { status: 400 })
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .eq('agency_id', profile!.agency_id)
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const withUrls = await Promise.all((documents ?? []).map(async (doc) => {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, SIGNED_URL_TTL)
    return { ...doc, url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json(withUrls)
}

export async function POST(request: Request) {
  const { supabase, user, profile, errorResponse } = await getAuthorizedAgency()
  if (errorResponse) return errorResponse

  const formData = await request.formData()
  const file = formData.get('file')
  const entity_type = formData.get('entity_type')
  const entity_id = formData.get('entity_id')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 })
  }
  if (typeof entity_type !== 'string' || !isEntityType(entity_type)) {
    return NextResponse.json({ error: 'entity_type inválido' }, { status: 400 })
  }
  if (typeof entity_id !== 'string' || !entity_id) {
    return NextResponse.json({ error: 'entity_id é obrigatório' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Ficheiro vazio' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 10MB)' }, { status: 400 })
  }

  // Defence in depth: verify the target entity belongs to the user's agency.
  // Never trust RLS alone — respond as if the entity doesn't exist otherwise.
  const table = ENTITY_TABLES[entity_type]
  const { data: entity, error: entityError } = await supabase
    .from(table)
    .select('id, agency_id')
    .eq('id', entity_id)
    .single()

  if (entityError || !entity || entity.agency_id !== profile!.agency_id) {
    return NextResponse.json({ error: 'Entidade não encontrada' }, { status: 404 })
  }

  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const path = `${profile!.agency_id}/${entity_type}/${entity_id}/${timestamp}-${random}-${sanitizeFilename(file.name)}`

  const { data: uploaded, error: uploadError } = await uploadFile(supabase, BUCKET, path, file)
  if (uploadError || !uploaded) {
    return NextResponse.json({ error: uploadError ?? 'Falha no upload' }, { status: 500 })
  }

  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({
      agency_id: profile!.agency_id,
      entity_type,
      entity_id,
      name: file.name,
      file_path: uploaded.path,
      file_type: file.type || null,
      file_size: file.size,
      uploaded_by: user!.id,
    })
    .select('*')
    .single()

  if (insertError || !document) {
    return NextResponse.json({ error: insertError?.message ?? 'Falha ao guardar documento' }, { status: 500 })
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(document.file_path, SIGNED_URL_TTL)

  return NextResponse.json({ ...document, url: signed?.signedUrl ?? null }, { status: 201 })
}
