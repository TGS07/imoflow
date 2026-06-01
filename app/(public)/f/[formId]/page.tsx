import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FormClient } from './FormClient'
import type { WebForm } from '@/types'

export default async function FormPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params
  const supabase = await createClient()

  const { data: form } = await supabase
    .from('web_forms')
    .select('id, agency_id, name, description, fields, stage_id, is_active, created_at')
    .eq('id', formId)
    .eq('is_active', true)
    .single()

  if (!form) notFound()

  return <FormClient form={form as WebForm} />
}
