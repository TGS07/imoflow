import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: leads }, { data: recentContacts }, { data: stages }] = await Promise.all([
    supabase.from('users').select('name').eq('id', user.id).single(),
    supabase.from('leads').select('id, name, stage_id, typology, zone, budget, deal_value, expected_close_date, created_at, pipeline_stages(id, name, color, probability, is_won, is_lost)').order('created_at', { ascending: false }),
    supabase.from('contacts').select('id, title, created_at, leads(name), users(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
  ])

  const allLeads = leads ?? []
  const allStages = stages ?? []
  const activeLeads = allLeads.filter(l => {
    const s = l.pipeline_stages as unknown as { is_won: boolean; is_lost: boolean } | null
    return s && !s.is_won && !s.is_lost
  }).length

  const wonLeads = allLeads.filter(l => {
    const s = l.pipeline_stages as unknown as { is_won: boolean } | null
    return s?.is_won
  })
  const closedThisMonth = wonLeads.filter(l => {
    const d = new Date(l.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const pipelineTotal = allLeads
    .filter(l => {
      const s = l.pipeline_stages as unknown as { is_won: boolean; is_lost: boolean } | null
      return s && !s.is_won && !s.is_lost
    })
    .reduce((sum, l) => sum + (l.deal_value ?? l.budget ?? 0), 0)

  const pipelineWeighted = allLeads
    .filter(l => {
      const s = l.pipeline_stages as unknown as { is_won: boolean; is_lost: boolean; probability: number } | null
      return s && !s.is_won && !s.is_lost
    })
    .reduce((sum, l) => {
      const s = l.pipeline_stages as unknown as { probability: number }
      return sum + ((l.deal_value ?? l.budget ?? 0) * s.probability / 100)
    }, 0)

  const stageCounts: Record<string, number> = {}
  for (const lead of allLeads) {
    stageCounts[lead.stage_id] = (stageCounts[lead.stage_id] ?? 0) + 1
  }
  const total = allLeads.length || 1
  const recentLeads = allLeads.slice(0, 5)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = profile?.name?.split(' ')[0] ?? ''

  function formatValue(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K€`
    return `${v}€`
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 500 }}>{greeting}, {firstName}</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{activeLeads} leads ativos</p>
        </div>
        <Link href="/leads" style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          + Novo Lead
        </Link>
      </div>

      <div style={{ padding: '28px 32px', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard label="Leads Ativos" value={activeLeads} icon="◎" />
          <StatCard label="Pipeline Total" value={formatValue(pipelineTotal)} icon="€" />
          <StatCard label="Pipeline Ponderado" value={formatValue(pipelineWeighted)} icon="◈" />
          <StatCard label="Fechados (mes)" value={closedThisMonth} icon="✓" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Pipeline de Vendas
              <Link href="/pipeline" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'var(--gold)', fontWeight: 500, textDecoration: 'none' }}>Ver tudo →</Link>
            </div>
            <div style={{ display: 'flex', gap: 2, height: 6, borderRadius: 4, overflow: 'hidden', marginBottom: 16, background: 'var(--border)' }}>
              {allLeads.length > 0 && allStages.filter(s => !s.is_lost).map(stage => {
                const count = stageCounts[stage.id] ?? 0
                if (count === 0) return null
                return <div key={stage.id} style={{ background: stage.color, width: `${(count / total) * 100}%` }} />
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              {allStages.filter(s => !s.is_lost).map(stage => {
                const count = stageCounts[stage.id] ?? 0
                return (
                  <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: stage.color }} />
                    {stage.name} ({count})
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentLeads.map(lead => {
                const leadStage = (lead.pipeline_stages as unknown as { name: string; color: string } | null)
                const color = leadStage?.color ?? '#666'
                const label = leadStage?.name ?? '—'
                return (
                  <Link key={lead.id} href={`/leads/${lead.id}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, textDecoration: 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#0D0D0F' }}>
                      {lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>{lead.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{lead.typology ?? ''}{lead.zone ? ` · ${lead.zone}` : ''}</div>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {lead.deal_value ? `${(lead.deal_value / 1000).toFixed(0)}K€` : lead.budget ? `${(lead.budget / 1000).toFixed(0)}K€` : '—'}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${color}22`, color }}>
                      {label}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 14 }}>Atividade Recente</div>
            <div>
              {(recentContacts ?? []).map((c, i) => (
                <div key={c.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < (recentContacts?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                    {i < (recentContacts?.length ?? 0) - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4, minHeight: 20 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text)', lineHeight: 1.5 }}>{c.title} — <strong style={{ color: 'var(--gold)', fontWeight: 500 }}>{(c.leads as unknown as { name: string } | null)?.name}</strong></div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{new Date(c.created_at).toLocaleDateString('pt-PT')}</div>
                  </div>
                </div>
              ))}
              {(recentContacts ?? []).length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem atividade recente.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
