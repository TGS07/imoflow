'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lead, Contact, Task, PipelineStage } from '@/types'
import { SendEmailModal } from '@/components/leads/SendEmailModal'

export default function LeadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [showEmail, setShowEmail] = useState(false)
  const [newContactTitle, setNewContactTitle] = useState('')
  const [newContactType, setNewContactType] = useState<Contact['type']>('nota')
  const [newContactDesc, setNewContactDesc] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')

  const fetchAll = useCallback(async () => {
    const [l, c, t, s] = await Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/contacts?lead_id=${id}`).then(r => r.json()),
      fetch(`/api/tasks?lead_id=${id}`).then(r => r.json()),
      fetch('/api/pipeline-stages').then(r => r.json()),
    ])
    setLead(l)
    setContacts(c)
    setTasks(t)
    setStages(s)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function updateStage(stageId: string) {
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: stageId }) })
    setLead(prev => prev ? { ...prev, stage_id: stageId } : prev)
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: id, type: newContactType, title: newContactTitle, description: newContactDesc }) })
    setNewContactTitle(''); setNewContactDesc('')
    fetchAll()
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: id, title: newTaskTitle, due_date: newTaskDue || null }) })
    setNewTaskTitle(''); setNewTaskDue('')
    fetchAll()
  }

  async function toggleTask(taskId: string, completed: boolean) {
    await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !completed }) })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !completed } : t))
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

  return (
    <>
      {showEmail && <SendEmailModal leadId={id} leadEmail={lead.email} onClose={() => setShowEmail(false)} onSent={fetchAll} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          <Link href="/leads" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Leads</Link>
          <span style={{ color: 'var(--border)' }}>›</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{lead.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowEmail(true)} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>✉ Enviar Email</button>
          <button onClick={archiveLead} style={{ ...inputStyle, background: 'rgba(224,92,92,0.1)', color: 'var(--red)', borderColor: 'rgba(224,92,92,0.25)', cursor: 'pointer' }}>✕ Arquivar</button>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="font-display" style={{ fontSize: 14 }}>Historico de Contactos</div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <form onSubmit={addContact} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select value={newContactType} onChange={e => setNewContactType(e.target.value as Contact['type'])} style={{ ...inputStyle, width: 'auto' }}>
                      <option value="nota">Nota</option>
                      <option value="chamada">Chamada</option>
                      <option value="visita">Visita</option>
                      <option value="email">Email</option>
                    </select>
                    <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Titulo do contacto..." value={newContactTitle} onChange={e => setNewContactTitle(e.target.value)} required />
                    <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Registar</button>
                  </div>
                  <textarea
                    style={{ ...inputStyle, width: '100%', resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
                    placeholder="Descricao (opcional)..."
                    value={newContactDesc}
                    onChange={e => setNewContactDesc(e.target.value)}
                  />
                </form>
                <div>
                  {contacts.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', gap: 12, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold)', marginTop: 3, flexShrink: 0 }} />
                        {i < contacts.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{c.title}</div>
                        {c.description && <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{c.description}</div>}
                        <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7, marginTop: 4 }}>{new Date(c.created_at).toLocaleString('pt-PT')} · {(c.users as unknown as { name: string } | null)?.name ?? ''}</div>
                      </div>
                    </div>
                  ))}
                  {contacts.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem historico ainda.</p>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div className="font-display" style={{ fontSize: 14 }}>Tarefas</div>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <form onSubmit={addTask} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  <input style={inputStyle} placeholder="Nova tarefa..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} required />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" style={{ ...inputStyle, flex: 1 }} value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} />
                    <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Criar</button>
                  </div>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasks.map(t => (
                    <div key={t.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, opacity: t.completed ? 0.5 : 1 }}>
                      <div onClick={() => toggleTask(t.id, t.completed)} style={{ width: 16, height: 16, borderRadius: 4, border: t.completed ? 'none' : '1.5px solid var(--border)', background: t.completed ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 1, color: '#0D0D0F', fontSize: 10 }}>
                        {t.completed ? '✓' : ''}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: t.completed ? 'var(--muted)' : 'var(--text)', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</div>
                        {t.due_date && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{new Date(t.due_date).toLocaleDateString('pt-PT')}</div>}
                      </div>
                    </div>
                  ))}
                  {tasks.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem tarefas.</p>}
                </div>
              </div>
            </div>

            {lead.notes && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                <div className="font-display" style={{ fontSize: 14, marginBottom: 10 }}>Notas</div>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{lead.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
