import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { Lead, PipelineStage } from '@/types'

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

  let leadsQuery = supabase
    .from('leads')
    .select('*, pipeline_stages(id, name, color, position, probability, is_won, is_lost)')
    .order('created_at', { ascending: false })

  if (profile?.role === 'agent') leadsQuery = leadsQuery.eq('assigned_to', user.id)

  const [{ data: leads }, { data: stages }] = await Promise.all([
    leadsQuery,
    supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
  ])

  return (
    <>
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 className="font-display" style={{ fontSize: 20 }}>Pipeline</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{leads?.length ?? 0} leads no pipeline</p>
      </div>
      <div style={{ padding: '24px 32px', flex: 1, overflow: 'hidden' }}>
        <KanbanBoard initialLeads={(leads ?? []) as Lead[]} stages={(stages ?? []) as PipelineStage[]} />
      </div>
    </>
  )
}
