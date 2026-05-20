import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { Lead } from '@/types'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <>
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 className="font-display" style={{ fontSize: 20 }}>Pipeline</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{leads?.length ?? 0} leads no pipeline</p>
      </div>
      <div style={{ padding: '24px 32px', flex: 1, overflow: 'hidden' }}>
        <KanbanBoard initialLeads={(leads ?? []) as Lead[]} />
      </div>
    </>
  )
}
