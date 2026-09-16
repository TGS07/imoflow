import { createClient } from '@/lib/supabase/server'
import { uploadFile, getPublicUrl } from '@/lib/supabase/storage'
import { NextResponse } from 'next/server'

const BUCKET = 'agency-logos'
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB, matches bucket limit

function sanitizeFilename(name: string) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Tipo de ficheiro inválido' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Ficheiro demasiado grande' }, { status: 400 })
  }

  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const path = `${profile.agency_id}/${timestamp}-${random}-${sanitizeFilename(file.name)}`

  const { data: uploaded, error: uploadError } = await uploadFile(supabase, BUCKET, path, file)
  if (uploadError || !uploaded) {
    return NextResponse.json({ error: uploadError ?? 'Falha no upload' }, { status: 500 })
  }

  const { data: urlData } = getPublicUrl(supabase, BUCKET, uploaded.path)
  if (!urlData?.publicUrl) {
    return NextResponse.json({ error: 'Falha ao gerar URL pública' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('agencies')
    .update({ logo_url: urlData.publicUrl })
    .eq('id', profile.agency_id)
    .select('logo_url')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logo_url: data.logo_url })
}
