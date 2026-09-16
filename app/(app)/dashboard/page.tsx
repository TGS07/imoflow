import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { HelpButton } from '@/components/help/HelpButton'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { daysSince, followupStatus } from '@/lib/contacts/followup'
import { matchSpecialDatesToday } from '@/lib/contacts/special-dates'
import { Icon } from '@/components/ui/Icon'
import { UpgradeBanner } from '@/components/billing/UpgradeBanner'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import type { Database } from '@/types/database'

// Shape do join `agencies(followup_first_days, followup_second_days)` — usado
// só nesta página.
type AgencyFollowupSettings = Pick<Database['public']['Tables']['agencies']['Row'], 'followup_first_days' | 'followup_second_days'>

// Shape do join `pipeline_stages(id, name, color, probability, is_won, is_lost)`
// usado em várias queries `leads(...)` desta página — mesmas colunas em todos
// os pontos, por isso um único tipo partilhado localmente.
type LeadStageJoin = Pick<Database['public']['Tables']['pipeline_stages']['Row'], 'id' | 'name' | 'color' | 'probability' | 'is_won' | 'is_lost'>

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

  const agencyRow = profile?.agencies as unknown as AgencyFollowupSettings | null
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
    const s = l.pipeline_stages as unknown as LeadStageJoin | null
    return s && !s.is_won && !s.is_lost
  }).length

  const wonLeads = allLeads.filter(l => {
    const s = l.pipeline_stages as unknown as LeadStageJoin | null
    return s?.is_won
  })
  const closedThisMonth = wonLeads.filter(l => {
    const d = new Date(l.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const pipelineTotal = allLeads
    .filter(l => {
      const s = l.pipeline_stages as unknown as LeadStageJoin | null
      return s && !s.is_won && !s.is_lost
    })
    .reduce((sum, l) => sum + (l.deal_value ?? l.budget ?? 0), 0)

  const pipelineWeighted = allLeads
    .filter(l => {
      const s = l.pipeline_stages as unknown as LeadStageJoin | null
      return s && !s.is_won && !s.is_lost
    })
    .reduce((sum, l) => {
      const s = l.pipeline_stages as unknown as LeadStageJoin
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
  const typeIconSvgs: Record<string, ReactNode> = {
    chamada: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    visita: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    email: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    reuniao: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    tarefa: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    nota: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  }

  const nowTs = new Date().getTime()
  const nextActivity = (todayActivities ?? []).find(a => !a.completed && a.due_date && new Date(a.due_date).getTime() >= nowTs)

  const stageValues: Record<string, number> = {}
  for (const lead of allLeads) {
    stageValues[lead.stage_id] = (stageValues[lead.stage_id] ?? 0) + (lead.deal_value ?? lead.budget ?? 0)
  }
  const nonLostStages = allStages.filter(s => !s.is_lost)
  const withLeads = nonLostStages.filter(s => (stageCounts[s.id] ?? 0) > 0)
  const funnelStages = (withLeads.length > 0 ? withLeads : nonLostStages).slice(0, 8)
  const maxStageCount = Math.max(1, ...funnelStages.map(s => stageCounts[s.id] ?? 0))

  const todayLabelRaw = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
  const todayLabel = todayLabelRaw.charAt(0).toUpperCase() + todayLabelRaw.slice(1)

  return (
    <div className="page-enter" style={{ padding: 'var(--space-6) var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.1 }}>{greeting}, {firstName} <HelpButton section="dashboard" /></h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 'var(--space-1)' }}>{todayLabel}</p>
        </div>
        <Link href="/leads" className="btn btn-primary">
          <Icon name="plus" size={14} /> Novo Lead
        </Link>
      </div>

      <UpgradeBanner />
      <OnboardingChecklist />

      {lastSync && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 'var(--space-6)', fontSize: 'var(--fs-sm)', color: 'var(--muted)', width: 'fit-content', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: lastSyncHoursAgo != null && lastSyncHoursAgo > 8 ? 'var(--red)' : 'var(--green)', boxShadow: lastSyncHoursAgo != null && lastSyncHoursAgo > 8 ? '0 0 0 3px rgba(220,38,38,0.12)' : '0 0 0 3px rgba(5,150,105,0.12)' }} />
          <span>Sincronização: <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{relativeSync(lastSync.ran_at)}</strong>{lastSync.contacts_processed > 0 && ` · ${lastSync.contacts_processed} atualizado${lastSync.contacts_processed !== 1 ? 's' : ''}`}</span>
        </div>
      )}

      {/* Stats row — 4 cards */}
      <div className="stagger stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-4) var(--space-6)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold-bright), transparent)', opacity: 0.45 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <span className="section-label">Leads Ativos</span>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--gold-glow)', border: '1px solid rgba(176,125,46,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
              <Icon name="leads" size={15} />
            </div>
          </div>
          <div className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.05 }}>{activeLeads}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginTop: 'var(--space-2)' }}>em negociação</div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4) var(--space-6)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold-bright), transparent)', opacity: 0.45 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <span className="section-label">Pipeline</span>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--gold-glow)', border: '1px solid rgba(176,125,46,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
              <Icon name="chart" size={15} />
            </div>
          </div>
          <div className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.05 }}>{formatValue(pipelineTotal)}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginTop: 'var(--space-2)' }}>{formatValue(pipelineWeighted)} ponderado</div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4) var(--space-6)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold-bright), transparent)', opacity: 0.45 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <span className="section-label">Fechados (mês)</span>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--gold-glow)', border: '1px solid rgba(176,125,46,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
              <Icon name="check" size={15} />
            </div>
          </div>
          <div className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.05 }}>{closedThisMonth}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginTop: 'var(--space-2)' }}>negócios ganhos</div>
        </div>

        {/* Previsão de fecho — highlight card com gradiente dourado */}
        <div className="card" style={{ padding: 'var(--space-4) var(--space-6)', background: 'var(--gold-gradient)', color: '#fff', border: 'none', boxShadow: 'var(--gold-gradient-shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <span className="section-label" style={{ color: 'rgba(255,255,255,0.7)' }}>Previsão de Fecho</span>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkle" size={15} />
            </div>
          </div>
          <div className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.05, color: '#fff' }}>{formatValue(pipelineWeighted)}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.7)', marginTop: 'var(--space-2)' }}>valor × probabilidade</div>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="dashboard-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 }}>
          {/* Funil de Vendas */}
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)' }}>
              <div className="font-display" style={{ fontSize: 'var(--fs-lg)' }}>Funil de Vendas</div>
              <Link href="/pipeline" style={{ fontSize: 'var(--fs-xs)', color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Ver pipeline →</Link>
            </div>
            {allLeads.length === 0 ? (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', padding: 'var(--space-3) 0' }}>Ainda sem leads no pipeline. Cria o primeiro lead para veres o funil.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {funnelStages.map(stage => {
                  const count = stageCounts[stage.id] ?? 0
                  const value = stageValues[stage.id] ?? 0
                  return (
                    <div key={stage.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: stage.color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.name}</span>
                      </div>
                      <div style={{ height: 22, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(count > 0 ? 6 : 0, (count / maxStageCount) * 100)}%`, borderRadius: 5, background: `linear-gradient(90deg, ${stage.color}55, ${stage.color}AA)`, borderRight: count > 0 ? `2px solid ${stage.color}` : 'none', transition: 'width 0.6s var(--ease)' }} />
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 90 }}>
                        <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{count}</strong> · {formatValue(value)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Leads Recentes */}
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)' }}>
              <div className="font-display" style={{ fontSize: 'var(--fs-lg)' }}>Leads Recentes</div>
              <Link href="/leads" style={{ fontSize: 'var(--fs-xs)', color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Ver todos →</Link>
            </div>
            {recentLeads.length === 0 ? (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', padding: 'var(--space-3) 0' }}>Sem leads registados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {recentLeads.map(lead => {
                  const leadStage = (lead.pipeline_stages as unknown as LeadStageJoin | null)
                  const color = leadStage?.color ?? '#666'
                  const label = leadStage?.name ?? '—'
                  return (
                    <Link key={lead.id} href={`/leads/${lead.id}`} className="card card-hover" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', textDecoration: 'none', boxShadow: 'none' }}>
                      <div className="avatar" style={{ width: 34, height: 34, fontSize: 'var(--fs-xs)', background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
                        {lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
                        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)', marginTop: 1 }}>{lead.typology ?? ''}{lead.zone ? ` · ${lead.zone}` : ''}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 'var(--fs-base)', whiteSpace: 'nowrap' }}>
                        {lead.deal_value ? `${(lead.deal_value / 1000).toFixed(0)}K€` : lead.budget ? `${(lead.budget / 1000).toFixed(0)}K€` : '—'}
                      </div>
                      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--radius-full)', background: `${color}1A`, border: `1px solid ${color}40`, color }}>
                        {label}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 }}>
          {/* Atividades de Hoje */}
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)' }}>
              <div className="font-display" style={{ fontSize: 'var(--fs-lg)' }}>Atividades de Hoje</div>
              <Link href="/activities" style={{ fontSize: 'var(--fs-xs)', color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Ver tudo →</Link>
            </div>
            {nextActivity && (
              <Link href="/activities" className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', background: 'var(--gold-glow)', border: '1px solid rgba(176,125,46,0.30)', boxShadow: 'none' }}>
                <span style={{ display: 'inline-flex', color: 'var(--gold)', flexShrink: 0 }}>{typeIconSvgs[nextActivity.type] ?? typeIconSvgs.nota}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>{nextActivity.title}</div>
                  <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)' }}>
                    {nextActivity.due_date && new Date(nextActivity.due_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    {nextActivity.leads?.[0]?.name && ` · ${nextActivity.leads[0].name}`}
                  </div>
                </div>
                <span className="badge badge-gold">A seguir</span>
              </Link>
            )}
            <div>
              {(todayActivities ?? []).map((a: { id: string; type: string; title: string; due_date: string | null; completed: boolean; leads: { name: string }[] | null; users: { name: string }[] | null }, i: number) => {
                const color = typeColors[a.type] ?? '#6B7280'
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: i < (todayActivities?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none', fontSize: 'var(--fs-sm)', opacity: a.completed ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 0 3px ${color}22` }} />
                      {i < (todayActivities?.length ?? 0) - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 6, minHeight: 20 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text)', lineHeight: 1.5, textDecoration: a.completed ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', color, flexShrink: 0 }}>{typeIconSvgs[a.type] ?? typeIconSvgs.nota}</span>
                        {a.title}
                        {a.leads?.[0]?.name && (
                          <span> — <strong style={{ color: 'var(--gold)', fontWeight: 600 }}>{a.leads[0].name}</strong></span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)', marginTop: 2 }}>
                        {a.due_date ? new Date(a.due_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''}
                        {a.users?.[0]?.name && ` · ${a.users[0].name}`}
                      </div>
                    </div>
                  </div>
                )
              })}
              {(todayActivities ?? []).length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-6) 0', color: 'var(--muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-2)' }}>
                    <Icon name="sun" size={28} style={{ color: 'var(--gold)', opacity: 0.5 }} />
                  </div>
                  <p style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>Dia livre — sem atividades agendadas.</p>
                </div>
              )}
            </div>
          </div>

          {/* Contactos a não esquecer */}
          {todayAgenda.length > 0 && (
            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <Icon name="sparkle" size={16} style={{ color: 'var(--gold)' }} />
                <span className="font-display" style={{ fontSize: 'var(--fs-lg)' }}>Contactos a não esquecer</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {todayAgenda.map((item, i) => (
                  <Link key={`${item.id}-${i}`} href={`/people/${item.id}`} className="card card-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', textDecoration: 'none', color: 'var(--text)', boxShadow: 'none' }}>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', textAlign: 'right' }}>{item.reason}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Atividades Pendentes (se não há nextActivity) */}
          {!nextActivity && (pendingCount ?? 0) > 0 && (
            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <span className="section-label">Atividades Pendentes</span>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--gold-glow)', border: '1px solid rgba(176,125,46,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
                  <Icon name="calendar" size={15} />
                </div>
              </div>
              <div className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.05 }}>{pendingCount ?? 0}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginTop: 'var(--space-2)' }}>por concluir</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
