import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PipelineBoard } from '@/components/pipeline/PipelineBoard'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  return <PipelineBoard isAdmin={profile.role === 'admin'} />
}
