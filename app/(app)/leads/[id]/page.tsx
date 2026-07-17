'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lead, PipelineStage, Activity, ActivityType } from '@/types'
import { SendEmailModal } from '@/components/leads/SendEmailModal'
import { WhatsAppModal } from '@/components/leads/WhatsAppModal'
import { LinkContactModal } from '@/components/leads/LinkContactModal'
import { Icon } from '@/components/ui/Icon'
import { REGULAR_INTERVAL_PRESETS } from '@/lib/contacts/special-dates'

const EXTRAS_SUGERIDOS = ['vista mar', 'garagem', 'piscina', 'jardim', 'varanda', 'elevador', 'ar condicionado', 'lareira']
const TIPOLOGIAS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+']

interface LeadPreference {
  id?: string
  lead_id?: string
  zonas: string[]
  tipologia_min: string | null
  preco_max: number | null
  extras: string[]
  is_active: boolean
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  chamada: '#3B82F6',
  visita: '#F59E0B',
  email: '#8B5CF6',
  reuniao: '#10B981',
  tarefa: '#EF4444',
  nota: '#6B7280',
  whatsapp: '#25D366',
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  chamada: '📞',
  visita: '🏠',
  email: '✉',
  reuniao: '🤝',
  tarefa: '✓',
  nota: '📝',
  whatsapp: '💬',
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  chamada: 'Chamada',
  visita: 'Visita',
  email: 'Email',
  reuniao: 'Reunião',
  tarefa: 'Tarefa',
  nota: 'Nota',
  whatsapp: 'WhatsApp',
}

export default function LeadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [showEmail, setShowEmail] = useState(false)
  const [showLinkContact, setShowLinkContact] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityType | ''>('')
  const [newActivity, setNewActivity] = useState({ type: 'nota' as ActivityType, title: '', description: '', due_date: '' })
  const [pref, setPref] = useState<LeadPreference>({ zonas: [], tipologia_min: null, preco_max: null, extras: [], is_active: true })
  const [prefLoaded, setPrefLoaded] = useState(false)
  const [prefSaving, setPrefSaving] = useState(false)
  const [zonaInput, setZonaInput] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<{ action: string; reason: string; urgency: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [customInterval, setCustomInterval] = useState('')

  useEffect(() => {
    fetch('/api/team/members')
      .then(r => r.ok ? r.json() : { members: [] })
      .then((d: { members: { id: string; name: string }[] }) => setMembers(d.members))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/lead-preferences/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) setPref({ zonas: d.zonas ?? [], tipologia_min: d.tipologia_min ?? null, preco_max: d.preco_max ?? null, extras: d.extras ?? [], is_active: d.is_active ?? true })
      })
      .catch(() => {})
      .finally(() => setPrefLoaded(true))
  }, [id])

  async function savePref() {
    setPrefSaving(true)
    await fetch(`/api/lead-preferences/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pref) })
    setPrefSaving(false)
  }

  async function fetchAiSuggestion() {
    setAiLoading(true)
    setAiSuggestion(null)
    try {
      const res = await fetch('/api/ai/suggest-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id }),
      })
      if (res.ok) setAiSuggestion(await res.json())
    } catch {
      // silently fail
    } finally {
      setAiLoading(false)
    }
  }

  function addZona() {
    const z = zonaInput.trim()
    if (z && !pref.zonas.includes(z)) setPref(p => ({ ...p, zonas: [...p.zonas, z] }))
    setZonaInput('')
  }

  function removeZona(z: string) { setPref(p => ({ ...p, zonas: p.zonas.filter(x => x !== z) })) }

  function toggleExtra(e: string) {
    setPref(p => ({ ...p, extras: p.extras.includes(e) ? p.extras.filter(x => x !== e) : [...p.extras, e] }))
  }

  const fetchAll = useCallback(async () => {
    const params = new URLSearchParams({ lead_id: id })
    if (activityFilter) params.set('type', activityFilter)

    const [l, a, s] = await Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/activities?${params}`).then(r => r.json()),
      fetch('/api/pipeline-stages').then(r => r.json()),
    ])
    setLead(l)
    setActivities(Array.isArray(a) ? a : [])
    setStages(s)
  }, [id, activityFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function updateStage(stageId: string) {
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: stageId }) })
    setLead(prev => prev ? { ...prev, stage_id: stageId } : prev)
  }

  async function toggleRegular() {
    if (!lead) return
    const next = !lead.is_regular
    setLead(prev => prev ? { ...prev, is_regular: next } : prev)
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_regular: next }) })
  }

  async function setRegularInterval(days: number | null) {
    setLead(prev => prev ? { ...prev, regular_interval_days: days } : prev)
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regular_interval_days: days }) })
    setCustomInterval('')
  }

  async function updateAssignee(userId: string) {
    setLead(prev => prev ? { ...prev, assigned_to: userId || null } : prev)
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_to: userId || null }) })
  }

  async function addActivity(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: id,
        type: newActivity.type,
        title: newActivity.title,
        description: newActivity.description || null,
        due_date: newActivity.due_date || null,
      })
    })
    setNewActivity({ type: 'nota', title: '', description: '', due_date: '' })
    fetchAll()
  }

  async function toggleActivity(activity: Activity) {
    await fetch(`/api/activities/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !activity.completed })
    })
    setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, completed: !a.completed } : a))
  }

  async function archiveLead() {
    if (!confirm('Arquivar este lead?')) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    router.push('/leads')
  }

  if (!lead) return (
    <div style={{ padding: 40 }}>
      <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 300 }} />
    </div>
  )

  const currentStage = lead.pipeline_stages ?? stages.find(s => s.id === lead.stage_id)
  const stageColor = currentStage?.color ?? '#666'
  const stageName = currentStage?.name ?? '—'
  const visibleStages = stages.filter(s => !s.is_lost)
  const initials = lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)' }

  const pendingActivities = activities.filter(a => !a.completed)
  const completedActivities = activities.filter(a => a.completed)

  return (
    <div className="page-enter">
      {showEmail && <SendEmailModal leadId={id} leadEmail={lead.email} onClose={() => setShowEmail(false)} onSent={fetchAll} />}
      {showWhatsApp && lead.phone && (
        <WhatsAppModal
          leadId={id}
          leadName={lead.name}
          leadPhone={lead.phone}
          leadEmail={lead.email}
          agentName={lead.users?.name}
          onClose={() => setShowWhatsApp(false)}
          onSent={fetchAll}
        />
      )}
      {showLinkContact && (
        <LinkContactModal leadId={id} onClose={() => setShowLinkContact(false)} onLinked={fetchAll} />
      )}

      {/* Breadcrumb header */}
      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          <Link href="/leads" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Leads</Link>
          <span style={{ color: 'var(--border-strong)' }}>›</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{lead.name}</span>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {lead.people ? (
            <Link href={`/people/${lead.people.id}`} title="Gerido na ficha do contacto" className="chip" style={{ height: 30, textDecoration: 'none' }}>
              {lead.people.is_regular ? '✓ Regular' : 'Não regular'} · {members.find(m => m.id === lead.people?.assigned_to)?.name ?? 'Sem responsável'} ↗
            </Link>
          ) : (
            <>
              <select value={lead.assigned_to ?? ''} onChange={e => updateAssignee(e.target.value)} title="Responsável" style={{ height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 12, padding: '0 8px', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                <option value="">Sem responsável</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={toggleRegular} title="Follow-ups automáticos" className={`chip${lead.is_regular ? ' active' : ''}`} style={{ height: 30 }}>
                {lead.is_regular ? '✓ Regular' : 'Regular'}
              </button>
            </>
          )}
          {lead.phone && (
            <button onClick={() => setShowWhatsApp(true)} className="btn btn-whatsapp btn-sm">
              <Icon name="whatsapp" size={13} /> WhatsApp
            </button>
          )}
          <button onClick={() => setShowEmail(true)} className="btn btn-ghost btn-sm">
            <Icon name="mail" size={13} /> Email
          </button>
          <button onClick={archiveLead} className="btn btn-danger btn-sm">
            <Icon name="close" size={12} /> Arquivar
          </button>
        </div>
      </div>

      <div className="page-pad" style={{ padding: '24px 32px' }}>
        {/* Hero Card */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'start', marginBottom: 0, flexWrap: 'wrap' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: `linear-gradient(135deg, ${stageColor}, ${stageColor}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 20, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <h2 className="font-display" style={{ fontSize: 22, marginBottom: 8 }}>{lead.name}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 5, background: `${stageColor}22`, color: stageColor, border: `1px solid ${stageColor}40` }}>
                {stageName}
              </span>
              <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 5, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                {lead.source}
              </span>
              {lead.deal_value && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 5, background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {(lead.deal_value / 1000).toFixed(0)}K€
                </span>
              )}
              {lead.expected_close_date && (
                <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 5, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  Fecho: {new Date(lead.expected_close_date).toLocaleDateString('pt-PT')}
                </span>
              )}
              {lead.people ? (
                <>
                  <Link href={`/people/${lead.people.id}`} style={{ textDecoration: 'none' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 5, background: 'rgba(176,125,46,0.08)', color: 'var(--gold)', border: '1px solid rgba(176,125,46,0.2)', cursor: 'pointer' }}>
                      👤 {lead.people.name}
                    </span>
                  </Link>
                  <span onClick={() => setShowLinkContact(true)} style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 5, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    🔗 Trocar contacto
                  </span>
                </>
              ) : (
                <span onClick={() => setShowLinkContact(true)} style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 5, background: 'rgba(176,125,46,0.08)', color: 'var(--gold)', border: '1px solid rgba(176,125,46,0.2)', cursor: 'pointer' }}>
                  🔗 Ligar contacto
                </span>
              )}
              {lead.organizations && (
                <Link href={`/organizations/${lead.organizations.id}`} style={{ textDecoration: 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 5, background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer' }}>
                    🏢 {lead.organizations.name}
                  </span>
                </Link>
              )}
              {lead.properties && (
                <Link href={`/properties/${lead.properties.id}`} style={{ textDecoration: 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 5, background: 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer' }}>
                    🏠 {lead.properties.reference ? `${lead.properties.reference} — ` : ''}{lead.properties.title}
                  </span>
                </Link>
              )}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {visibleStages.map(s => (
                <button key={s.id} onClick={() => updateStage(s.id)} className="chip" style={lead.stage_id === s.id ? { background: `${s.color}1A`, color: s.color, borderColor: `${s.color}66` } : undefined}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Score</div>
            <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--gold)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="font-display" style={{ fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>{lead.score}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)' }}>/100</div>
            </div>
          </div>
        </div>
        </div>

        {/* Info Pills */}
        <div className="stagger" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { icon: '📞', label: 'Telefone', value: lead.phone },
            { icon: '✉', label: 'Email', value: lead.email },
            { icon: '📍', label: 'Zona', value: lead.zone },
            { icon: '🏠', label: 'Tipologia', value: lead.typology },
            { icon: '€', label: 'Orçamento', value: lead.budget ? `${(lead.budget/1000).toFixed(0)}K€` : null },
          ].filter(p => p.value).map(p => (
            <div key={p.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}>
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{p.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Frequência de follow-up própria (só quando "Regular" está ativo e não há contacto associado) */}
        {!lead.people && lead.is_regular && (
          <div className="card" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Frequência de follow-up: {lead.regular_interval_days ? `a cada ${lead.regular_interval_days} dias` : 'prazos da agência (padrão)'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
              <button type="button" onClick={() => setRegularInterval(null)} className={`chip${lead.regular_interval_days == null ? ' active' : ''}`}>Prazos da agência</button>
              {REGULAR_INTERVAL_PRESETS.map(d => (
                <button key={d} type="button" onClick={() => setRegularInterval(d)} className={`chip${lead.regular_interval_days === d ? ' active' : ''}`}>{d} dias</button>
              ))}
              <input style={{ ...inputStyle, width: 90, padding: '4px 10px' }} type="number" min={1} placeholder="outro (dias)" value={customInterval} onChange={e => setCustomInterval(e.target.value)} />
              <button type="button" disabled={!customInterval} onClick={() => setRegularInterval(Number(customInterval))} className="btn btn-ghost btn-sm">Aplicar</button>
            </div>
          </div>
        )}

        {/* AI Suggestion Card */}
        <div className="card" style={{ overflow: 'hidden', marginBottom: 20, border: '1px solid rgba(176,125,46,0.25)' }}>
          <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, color: 'var(--gold)' }}>✦</span>
              <span className="font-display" style={{ fontSize: 13, color: 'var(--gold)' }}>Sugestão IA</span>
            </div>
            <button
              onClick={fetchAiSuggestion}
              disabled={aiLoading}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, opacity: aiLoading ? 0.6 : 1 }}
            >
              {aiLoading ? 'A analisar...' : aiSuggestion ? '↺ Atualizar' : 'Analisar lead'}
            </button>
          </div>
          {aiSuggestion && (
            <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 9, padding: '2px 7px', borderRadius: 3, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                  background: aiSuggestion.urgency === 'alta' ? '#FEE2E2' : aiSuggestion.urgency === 'media' ? '#FEF3C7' : '#F0FDF4',
                  color: aiSuggestion.urgency === 'alta' ? '#DC2626' : aiSuggestion.urgency === 'media' ? '#D97706' : '#16A34A',
                }}>
                  {aiSuggestion.urgency}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{aiSuggestion.action}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>{aiSuggestion.reason}</p>
            </div>
          )}
          {!aiSuggestion && !aiLoading && (
            <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 18px 14px', margin: 0 }}>
              Clica em "Analisar lead" para receber uma sugestão personalizada.
            </p>
          )}
        </div>

        {/* Activities Section */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="font-display" style={{ fontSize: 14 }}>Atividades</div>
            <Link href="/activities" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>Ver calendário →</Link>
          </div>

          {/* Type Filter Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
            <button onClick={() => setActivityFilter('')} style={{ padding: '10px 16px', fontSize: 11, fontWeight: activityFilter === '' ? 600 : 400, color: activityFilter === '' ? 'var(--gold)' : 'var(--muted)', background: 'transparent', border: 'none', borderBottom: activityFilter === '' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
              Todas ({activities.length})
            </button>
            {(Object.entries(ACTIVITY_LABELS) as [ActivityType, string][]).map(([type, label]) => {
              const count = activities.filter(a => a.type === type).length
              if (count === 0 && activityFilter !== type) return null
              return (
                <button key={type} onClick={() => setActivityFilter(activityFilter === type ? '' : type)} style={{ padding: '10px 16px', fontSize: 11, fontWeight: activityFilter === type ? 600 : 400, color: activityFilter === type ? ACTIVITY_COLORS[type] : 'var(--muted)', background: 'transparent', border: 'none', borderBottom: activityFilter === type ? `2px solid ${ACTIVITY_COLORS[type]}` : '2px solid transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
                  {ACTIVITY_ICONS[type]} {label} ({count})
                </button>
              )
            })}
          </div>

          {/* Add Activity Form */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <form onSubmit={addActivity} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select value={newActivity.type} onChange={e => setNewActivity(p => ({ ...p, type: e.target.value as ActivityType }))} style={{ ...inputStyle, width: 'auto' }}>
                  {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} placeholder="Título da atividade..." value={newActivity.title} onChange={e => setNewActivity(p => ({ ...p, title: e.target.value }))} required />
                <input type="datetime-local" className="hide-mobile" style={{ ...inputStyle, width: 'auto' }} value={newActivity.due_date} onChange={e => setNewActivity(p => ({ ...p, due_date: e.target.value }))} />
                <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Adicionar</button>
              </div>
              <textarea
                style={{ ...inputStyle, width: '100%', resize: 'vertical', minHeight: 50, lineHeight: 1.5 }}
                placeholder="Descrição (opcional)..."
                value={newActivity.description}
                onChange={e => setNewActivity(p => ({ ...p, description: e.target.value }))}
              />
            </form>
          </div>

          {/* Activities List */}
          <div style={{ padding: '14px 18px' }}>
            {pendingActivities.length > 0 && (
              <div style={{ marginBottom: completedActivities.length > 0 ? 16 : 0 }}>
                {pendingActivities.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', gap: 12, paddingBottom: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div onClick={() => toggleActivity(a)} style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--border-strong)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
                      {i < pendingActivities.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: `${ACTIVITY_COLORS[a.type]}22`, color: ACTIVITY_COLORS[a.type], fontWeight: 500 }}>
                          {ACTIVITY_ICONS[a.type]} {ACTIVITY_LABELS[a.type]}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.title}</span>
                      </div>
                      {a.description && <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{a.description}</div>}
                      <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7, marginTop: 4 }}>
                        {a.due_date ? new Date(a.due_date).toLocaleString('pt-PT') : new Date(a.created_at).toLocaleString('pt-PT')}
                        {a.users && ` · ${a.users.name}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedActivities.length > 0 && (
              <div>
                {pendingActivities.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Concluídas</div>
                )}
                {completedActivities.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', gap: 12, paddingBottom: 14, opacity: 0.5 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div onClick={() => toggleActivity(a)} style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2, color: '#fff', fontSize: 10 }}>✓</div>
                      {i < completedActivities.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: `${ACTIVITY_COLORS[a.type]}22`, color: ACTIVITY_COLORS[a.type], fontWeight: 500 }}>
                          {ACTIVITY_ICONS[a.type]} {ACTIVITY_LABELS[a.type]}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'line-through' }}>{a.title}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7, marginTop: 4 }}>
                        {a.due_date ? new Date(a.due_date).toLocaleString('pt-PT') : new Date(a.created_at).toLocaleString('pt-PT')}
                        {a.users && ` · ${a.users.name}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activities.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem atividades ainda.</p>
            )}
          </div>
        </div>

        {/* Notes */}
        {lead.notes && (
          <div className="card" style={{ padding: '14px 18px', marginTop: 20 }}>
            <div className="font-display" style={{ fontSize: 14, marginBottom: 10 }}>Notas</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{lead.notes}</p>
          </div>
        )}

        {/* Preferências Idealista */}
        {prefLoaded && (
          <div className="card" style={{ overflow: 'hidden', marginTop: 20 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="font-display" style={{ fontSize: 14 }}>🏠 Preferências Idealista</div>
                <div
                  onClick={() => setPref(p => ({ ...p, is_active: !p.is_active }))}
                  style={{ width: 32, height: 18, borderRadius: 9, background: pref.is_active ? 'var(--gold)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 2, left: pref.is_active ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
                <span style={{ fontSize: 10, color: pref.is_active ? 'var(--gold)' : 'var(--muted)', fontWeight: 500 }}>{pref.is_active ? 'Ativo' : 'Inativo'}</span>
              </div>
              <button onClick={savePref} disabled={prefSaving} className="btn btn-primary btn-sm" style={{ opacity: prefSaving ? 0.6 : 1 }}>
                {prefSaving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>

            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Zonas */}
              <div>
                <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Zonas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {pref.zonas.map(z => (
                    <span key={z} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'rgba(176,125,46,0.10)', color: 'var(--gold)', border: '1px solid rgba(176,125,46,0.2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {z}
                      <span onClick={() => removeZona(z)} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 13, lineHeight: 1 }}>×</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={zonaInput}
                    onChange={e => setZonaInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addZona() } }}
                    placeholder="Ex: Cascais, Parede..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={addZona} className="btn btn-ghost btn-sm">+ Zona</button>
                </div>
              </div>

              {/* Tipologia + Preço */}
              <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Tipologia mínima</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {TIPOLOGIAS.map(t => (
                      <button
                        key={t}
                        onClick={() => setPref(p => ({ ...p, tipologia_min: p.tipologia_min === t ? null : t }))}
                        className={`chip${pref.tipologia_min === t ? ' active' : ''}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Preço máximo (€)</div>
                  <input
                    type="number"
                    value={pref.preco_max ?? ''}
                    onChange={e => setPref(p => ({ ...p, preco_max: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="Ex: 400000"
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
              </div>

              {/* Extras */}
              <div>
                <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Extras</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EXTRAS_SUGERIDOS.map(e => (
                    <button
                      key={e}
                      onClick={() => toggleExtra(e)}
                      className={`chip${pref.extras.includes(e) ? ' active' : ''}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
