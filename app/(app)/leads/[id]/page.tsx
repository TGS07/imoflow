'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lead, PipelineStage, Activity, ActivityType } from '@/types'
import { SendEmailModal } from '@/components/leads/SendEmailModal'
import { WhatsAppModal } from '@/components/leads/WhatsAppModal'
import { Icon } from '@/components/ui/Icon'

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
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityType | ''>('')
  const [newActivity, setNewActivity] = useState({ type: 'nota' as ActivityType, title: '', description: '', due_date: '' })

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

  if (!lead) return <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar...</div>

  const currentStage = lead.pipeline_stages ?? stages.find(s => s.id === lead.stage_id)
  const stageColor = currentStage?.color ?? '#666'
  const stageName = currentStage?.name ?? '—'
  const visibleStages = stages.filter(s => !s.is_lost)
  const initials = lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

  const pendingActivities = activities.filter(a => !a.completed)
  const completedActivities = activities.filter(a => a.completed)

  return (
    <>
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          <Link href="/leads" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Leads</Link>
          <span style={{ color: 'var(--border)' }}>›</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{lead.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {lead.phone && (
            <button onClick={() => setShowWhatsApp(true)} className="btn btn-whatsapp" style={{ padding: '8px 14px', fontSize: 12 }}>
              <Icon name="whatsapp" size={14} /> WhatsApp
            </button>
          )}
          <button onClick={() => setShowEmail(true)} className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }}>
            <Icon name="mail" size={14} /> Enviar Email
          </button>
          <button onClick={archiveLead} className="btn btn-danger" style={{ padding: '8px 14px', fontSize: 12 }}>
            <Icon name="close" size={13} /> Arquivar
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* Hero Card */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 20, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 20, alignItems: 'start' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${stageColor}, ${stageColor}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#fff' }}>
            {initials}
          </div>
          <div>
            <h2 className="font-display" style={{ fontSize: 22, marginBottom: 8 }}>{lead.name}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: `${stageColor}22`, color: stageColor }}>
                {stageName}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
                {lead.source}
              </span>
              {lead.deal_value && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                  {(lead.deal_value / 1000).toFixed(0)}K€
                </span>
              )}
              {lead.expected_close_date && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
                  Fecho: {new Date(lead.expected_close_date).toLocaleDateString('pt-PT')}
                </span>
              )}
              {lead.people && (
                <Link href={`/people/${lead.people.id}`} style={{ textDecoration: 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', cursor: 'pointer' }}>
                    👤 {lead.people.name}
                  </span>
                </Link>
              )}
              {lead.organizations && (
                <Link href={`/organizations/${lead.organizations.id}`} style={{ textDecoration: 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', cursor: 'pointer' }}>
                    🏢 {lead.organizations.name}
                  </span>
                </Link>
              )}
              {lead.properties && (
                <Link href={`/properties/${lead.properties.id}`} style={{ textDecoration: 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(16,185,129,0.1)', color: '#10B981', cursor: 'pointer' }}>
                    🏠 {lead.properties.reference ? `${lead.properties.reference} — ` : ''}{lead.properties.title}
                  </span>
                </Link>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {visibleStages.map(s => (
                <button key={s.id} onClick={() => updateStage(s.id)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: `1px solid ${lead.stage_id === s.id ? s.color : 'var(--border)'}`, background: lead.stage_id === s.id ? `${s.color}22` : 'transparent', color: lead.stage_id === s.id ? s.color : 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif', fontWeight: 600 }}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Score</div>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--gold)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>
              <div className="font-display" style={{ fontSize: 20, color: 'var(--gold)', lineHeight: 1 }}>{lead.score}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)' }}>/100</div>
            </div>
          </div>
        </div>

        {/* Info Pills */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { icon: '📞', label: 'Telefone', value: lead.phone },
            { icon: '✉', label: 'Email', value: lead.email },
            { icon: '📍', label: 'Zona', value: lead.zone },
            { icon: '🏠', label: 'Tipologia', value: lead.typology },
            { icon: '€', label: 'Orcamento', value: lead.budget ? `${(lead.budget/1000).toFixed(0)}K€` : null },
          ].filter(p => p.value).map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.label}</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{p.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Unified Activities Section */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="font-display" style={{ fontSize: 14 }}>Atividades</div>
            <Link href="/activities" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>Ver calendário →</Link>
          </div>

          {/* Type Filter Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
            <button onClick={() => setActivityFilter('')} style={{ padding: '10px 16px', fontSize: 11, fontWeight: activityFilter === '' ? 600 : 400, color: activityFilter === '' ? 'var(--gold)' : 'var(--muted)', background: 'transparent', border: 'none', borderBottom: activityFilter === '' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontFamily: 'Jost, sans-serif', whiteSpace: 'nowrap' }}>
              Todas ({activities.length})
            </button>
            {(Object.entries(ACTIVITY_LABELS) as [ActivityType, string][]).map(([type, label]) => {
              const count = activities.filter(a => a.type === type).length
              if (count === 0 && activityFilter !== type) return null
              return (
                <button key={type} onClick={() => setActivityFilter(activityFilter === type ? '' : type)} style={{ padding: '10px 16px', fontSize: 11, fontWeight: activityFilter === type ? 600 : 400, color: activityFilter === type ? ACTIVITY_COLORS[type] : 'var(--muted)', background: 'transparent', border: 'none', borderBottom: activityFilter === type ? `2px solid ${ACTIVITY_COLORS[type]}` : '2px solid transparent', cursor: 'pointer', fontFamily: 'Jost, sans-serif', whiteSpace: 'nowrap' }}>
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
                  {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Título da atividade..." value={newActivity.title} onChange={e => setNewActivity(p => ({ ...p, title: e.target.value }))} required />
                <input type="datetime-local" style={{ ...inputStyle, width: 'auto' }} value={newActivity.due_date} onChange={e => setNewActivity(p => ({ ...p, due_date: e.target.value }))} />
                <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Adicionar</button>
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
            {/* Pending */}
            {pendingActivities.length > 0 && (
              <div style={{ marginBottom: completedActivities.length > 0 ? 16 : 0 }}>
                {pendingActivities.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', gap: 12, paddingBottom: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div onClick={() => toggleActivity(a)} style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--border)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
                      {i < pendingActivities.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
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

            {/* Completed */}
            {completedActivities.length > 0 && (
              <div>
                {pendingActivities.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Concluídas</div>
                )}
                {completedActivities.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', gap: 12, paddingBottom: 14, opacity: 0.5 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div onClick={() => toggleActivity(a)} style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2, color: '#0D0D0F', fontSize: 10 }}>✓</div>
                      {i < completedActivities.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
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
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginTop: 20 }}>
            <div className="font-display" style={{ fontSize: 14, marginBottom: 10 }}>Notas</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{lead.notes}</p>
          </div>
        )}
      </div>
    </>
  )
}
