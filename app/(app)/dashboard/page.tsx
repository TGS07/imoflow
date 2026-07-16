import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import Link from 'next/link'
import { daysSince, followupStatus } from '@/lib/contacts/followup'
import { matchSpecialDatesToday } from '@/lib/contacts/special-dates'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString()
  const todayEnd = new Date(new Date().setHours(23,59,59,999)).toISOString()

  const [{ data: profile }, { data: leads }, { data: todayActivities }, { count: pendingCount }, { data: stages }, { data: lastSyncRows }, { data: agendaPeople }] = await Promise.all([
    supabase.from('users').select('name, agency_id, agencies(followup_first_days, followup_second_days)').eq('id', user.id).single(),
    supabase.from('leads').select('id, name, stage_id, typology, zone, budget, deal_value, expected_close_date, created_at, pipeline_stages(id, name, color, probability, is_won, is_lost)').order('created_at', { ascending: false }),
    supabase.from('activities').select('id, type, title, due_date, completed, leads(name), users:assigned_to(name)').gte('due_date', todayStart).lte('due_date', todayEnd).order('due_date', { ascending: true }),
    supabase.from('activities').select('id', { count: 'exact', head: true }).eq('completed', false),
    supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
    supabase.from('contacts_sync_runs').select('ran_at, contacts_processed').order('ran_at', { ascending: false }).limit(1),
    supabase.from('people')
      .select('id, name, is_regular, is_special, last_interaction_at, created_at, regular_interval_days, birthday, special_notify_christmas, special_notify_easter, special_notify_birthday, special_dates')
      .or('is_regular.eq.true,is_special.eq.true')
      .eq('assigned_to', user.id),
  ])

  // Bloco "Hoje": contactos regulares atrasados + datas especiais de hoje,
  // só os atribuídos a este utilizador (mesma lógica do cron diário).
  const agencyRow = profile?.agencies as unknown as { followup_first_days: number; followup_second_days: number } | null
  const agencyFirst = agencyRow?.followup_first_days ?? 7
  const agencySecond = agencyRow?.followup_second_days ?? 30
  const specialIcons: Record<string, string> = { Natal: '🎄', Páscoa: '🐣', Aniversário: '🎂' }

  type AgendaItem = { id: string; name: string; reason: string }
  const todayAgenda: AgendaItem[] = []
  for (const p of agendaPeople ?? []) {
    if (p.is_regular) {
      const days = daysSince(new Date(p.last_interaction_at ?? p.created_at))
      const status = followupStatus(days, p.regular_interval_days, agencyFirst, agencySecond)
      if (status.due) todayAgenda.push({ id: p.id, name: p.name, reason: `Follow-up atrasado ${status.daysSince} dias` })
    }
    if (p.is_special) {
      for (const match of matchSpecialDatesToday(p)) {
        todayAgenda.push({ id: p.id, name: p.name, reason: `${specialIcons[match.label] ?? '✦'} ${match.label} hoje` })
      }
    }
  }

  const lastSync = lastSyncRows?.[0] ?? null
  const lastSyncHoursAgo = lastSync ? (Date.now() - new Date(lastSync.ran_at).getTime()) / 3_600_000 : null

  function relativeSync(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (mins < 1) return 'agora mesmo'
    if (mins < 60) return `há ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `há ${hours}h`
    const days = Math.floor(hours / 24)
    return `há ${days}d`
  }

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

  const typeColors: Record<string, string> = { chamada: '#3B82F6', visita: '#F59E0B', email: '#8B5CF6', reuniao: '#10B981', tarefa: '#EF4444', nota: '#6B7280' }
  const typeIcons: Record<string, string> = { chamada: '📞', visita: '🏠', email: '✉', reuniao: '🤝', tarefa: '✓', nota: '📝' }

  // Próximo evento de hoje (ainda por acontecer e não concluído)
  const nowTs = new Date().getTime()
  const nextActivity = (todayActivities ?? []).find(a => !a.completed && a.due_date && new Date(a.due_date).getTime() >= nowTs)

  return (
    <>
      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 500 }}>{greeting}, {firstName}</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{activeLeads} leads ativos</p>
        </div>
        <Link href="/leads" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          + Novo Lead
        </Link>
      </div>

      <div className="page-enter page-pad" style={{ padding: '28px 32px', flex: 1 }}>
        {lastSync && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: lastSyncHoursAgo != null && lastSyncHoursAgo > 8 ? '#EF4444' : '#10B981' }} />
            <span>Sincronização de Contactos (iPhone): <strong style={{ color: 'var(--text)' }}>{relativeSync(lastSync.ran_at)}</strong>{lastSync.contacts_processed > 0 && ` · ${lastSync.contacts_processed} atualizado${lastSync.contacts_processed !== 1 ? 's' : ''}`}</span>
          </div>
        )}
        <div className="stagger stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard label="Leads Ativos" value={activeLeads} icon="leads" />
          <StatCard label="Pipeline Total" value={formatValue(pipelineTotal)} icon="chart" />
          <StatCard label="Pipeline Ponderado" value={formatValue(pipelineWeighted)} icon="pipeline" />
          <StatCard label="Fechados (mes)" value={closedThisMonth} icon="check" />
          <StatCard label="Atividades Pendentes" value={pendingCount ?? 0} icon="calendar" />
        </div>

        <div className="dashboard-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>
          <div className="card" style={{ padding: 22 }}>
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
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="table-row" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, textDecoration: 'none' }}>
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

          <div className="card" style={{ padding: 22 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Atividades de Hoje
              <Link href="/activities" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'var(--gold)', fontWeight: 500, textDecoration: 'none' }}>Ver tudo →</Link>
            </div>
            {nextActivity && (
              <Link href="/activities" style={{ display: 'block', textDecoration: 'none', background: 'var(--gold-glow)', border: '1px solid var(--gold)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700, marginBottom: 3 }}>A seguir</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {typeIcons[nextActivity.type] ?? '📝'} {nextActivity.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {nextActivity.due_date && new Date(nextActivity.due_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  {nextActivity.leads?.[0]?.name && ` · ${nextActivity.leads[0].name}`}
                </div>
              </Link>
            )}
            <div>
              {(todayActivities ?? []).map((a: { id: string; type: string; title: string; due_date: string | null; completed: boolean; leads: { name: string }[] | null; users: { name: string }[] | null }, i: number) => {
                const color = typeColors[a.type] ?? '#6B7280'
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < (todayActivities?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none', fontSize: 12, opacity: a.completed ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      {i < (todayActivities?.length ?? 0) - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4, minHeight: 20 }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text)', lineHeight: 1.5, textDecoration: a.completed ? 'line-through' : 'none' }}>
                        {typeIcons[a.type] ?? '📝'} {a.title}
                        {a.leads?.[0]?.name && (
                          <span> — <strong style={{ color: 'var(--gold)', fontWeight: 500 }}>{a.leads[0].name}</strong></span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        {a.due_date ? new Date(a.due_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''}
                        {a.users?.[0]?.name && ` · ${a.users[0].name}`}
                      </div>
                    </div>
                  </div>
                )
              })}
              {(todayActivities ?? []).length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem atividades para hoje.</p>}
            </div>
          </div>
        </div>

        {todayAgenda.length > 0 && (
          <div className="card" style={{ padding: 22, marginBottom: 20 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 14 }}>✦ Agenda de hoje</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayAgenda.map((item, i) => (
                <Link key={`${item.id}-${i}`} href={`/people/${item.id}`} className="table-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, textDecoration: 'none', color: 'var(--text)' }}>
                  <span style={{ fontWeight: 500 }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{item.reason}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
