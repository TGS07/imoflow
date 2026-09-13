import { createClient } from '@/lib/supabase/server'
import { deleteFile } from '@/lib/supabase/storage'
import { NextResponse } from 'next/server'

const BUCKET = 'documents'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Defence in depth: verify the document belongs to the user's agency before touching anything.
  const { data: document, error } = await supabase
    .from('documents')
    .select('id, agency_id, file_path')
    .eq('id', id)
    .single()

  if (error || !document || document.agency_id !== profile.agency_id) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
  }

  const { error: deleteError } = await deleteFile(supabase, BUCKET, document.file_path)
  if (deleteError) return NextResponse.json({ error: deleteError }, { status: 500 })

  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
