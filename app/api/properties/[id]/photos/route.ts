import { createClient } from '@/lib/supabase/server'
import { uploadFile, getPublicUrl, deleteFile } from '@/lib/supabase/storage'
import { NextResponse } from 'next/server'

const BUCKET = 'property-photos'

async function getAuthorizedProperty(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null, property: null, errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { supabase, user, profile: null, property: null, errorResponse: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }

  const { data: property, error } = await supabase
    .from('properties')
    .select('id, photos, agency_id')
    .eq('id', id)
    .single()

  if (error || !property) return { supabase, user, profile, property: null, errorResponse: NextResponse.json({ error: 'Property not found' }, { status: 404 }) }

  return { supabase, user, profile, property, errorResponse: null }
}

function sanitizeFilename(name: string) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

function extractPathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, property, errorResponse } = await getAuthorizedProperty(id)
  if (errorResponse) return errorResponse

  const formData = await request.formData()
  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  if (files.length === 0) return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 })

  const newUrls: string[] = []
  for (const file of files) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8)
    const path = `${property!.agency_id}/${id}/${timestamp}-${random}-${sanitizeFilename(file.name)}`

    const { data: uploaded, error: uploadError } = await uploadFile(supabase, BUCKET, path, file)
    if (uploadError || !uploaded) {
      return NextResponse.json({ error: uploadError ?? 'Falha no upload' }, { status: 500 })
    }

    const { data: urlData } = getPublicUrl(supabase, BUCKET, uploaded.path)
    if (urlData?.publicUrl) newUrls.push(urlData.publicUrl)
  }

  const existingPhotos: string[] = property!.photos ?? []
  const updatedPhotos = [...existingPhotos, ...newUrls]

  const { data, error } = await supabase
    .from('properties')
    .update({ photos: updatedPhotos })
    .eq('id', id)
    .select('photos')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data.photos })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, property, errorResponse } = await getAuthorizedProperty(id)
  if (errorResponse) return errorResponse

  const body = await request.json()
  const url: string | undefined = body?.url
  if (!url) return NextResponse.json({ error: 'URL em falta' }, { status: 400 })

  const path = extractPathFromPublicUrl(url)
  if (path) {
    const { error: deleteError } = await deleteFile(supabase, BUCKET, path)
    if (deleteError) return NextResponse.json({ error: deleteError }, { status: 500 })
  }

  const existingPhotos: string[] = property!.photos ?? []
  const updatedPhotos = existingPhotos.filter(p => p !== url)

  const { data, error } = await supabase
    .from('properties')
    .update({ photos: updatedPhotos })
    .eq('id', id)
    .select('photos')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data.photos })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, errorResponse } = await getAuthorizedProperty(id)
  if (errorResponse) return errorResponse

  const body = await request.json()
  const photos: string[] | undefined = body?.photos
  if (!Array.isArray(photos)) return NextResponse.json({ error: 'photos deve ser um array' }, { status: 400 })

  const { data, error } = await supabase
    .from('properties')
    .update({ photos })
    .eq('id', id)
    .select('photos')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data.photos })
}
