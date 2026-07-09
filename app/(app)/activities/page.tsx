'use client'
import { useState, useEffect, useCallback } from 'react'
import { Activity, ActivityType } from '@/types'
import Link from 'next/link'
import { CalendarTimeGrid } from '@/components/activities/CalendarTimeGrid'
import { AudioRecorder } from '@/components/shared/AudioRecorder'

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

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type ViewMode = 'month' | 'week' | 'day'

// Converte Date para o formato do input datetime-local (hora local)
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [pending, setPending] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'tarefa' as ActivityType, title: '', description: '', due_date: '', end_date: '', lead_id: '' })
  const [creating, setCreating] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [addMode, setAddMode] = useState<'manual' | 'audio'>('manual')
  const VALID_ACTIVITY_TYPES = Object.keys(ACTIVITY_LABELS)

  function applyVoiceActivity(f: Record<string, unknown>) {
    setForm(p => ({
      ...p,
      type: typeof f.type === 'string' && VALID_ACTIVITY_TYPES.includes(f.type) ? f.type as ActivityType : p.type,
      title: typeof f.title === 'string' ? f.title : p.title,
      description: typeof f.description === 'string' ? f.description : p.description,
    }))
    setAddMode('manual')
  }

  const fetchActivities = useCallback(async () => {
    let dateFrom: string
    let dateTo: string

    if (view === 'month') {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const startOffset = (firstDay.getDay() + 6) % 7
      const start = new Date(firstDay)
      start.setDate(start.getDate() - startOffset)
      const end = new Date(lastDay)
      end.setDate(end.getDate() + (6 - ((lastDay.getDay() + 6) % 7)))
      dateFrom = start.toISOString()
      dateTo = end.toISOString()
    } else if (view === 'day') {
      const start = new Date(currentDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(currentDate)
      end.setHours(23, 59, 59, 999)
      dateFrom = start.toISOString()
      dateTo = end.toISOString()
    } else {
      const day = currentDate.getDay()
      const mondayOffset = (day + 6) % 7
      const monday = new Date(currentDate)
      monday.setDate(monday.getDate() - mondayOffset)
      monday.setHours(0, 0, 0, 0)
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)
      dateFrom = monday.toISOString()
      dateTo = sunday.toISOString()
    }

    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    if (filterType) params.set('type', filterType)

    try {
      const res = await fetch(`/api/activities?${params}`)
      if (!res.ok) throw new Error()
      setActivities(await res.json())
    } catch { setActivities([]) }
    finally { setLoading(false) }
  }, [currentDate, view, filterType])

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/activities?completed=false')
      if (!res.ok) throw new Error()
      setPending(await res.json())
    } catch { setPending([]) }
  }, [])

  useEffect(() => { fetchActivities(); fetchPending() }, [fetchActivities, fetchPending])

  async function createActivity(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          description: form.description || null,
          due_date: form.due_date || null,
          end_date: form.end_date || null,
          lead_id: form.lead_id || null,
        })
      })
      if (res.ok) {
        setForm({ type: 'tarefa', title: '', description: '', due_date: '', end_date: '', lead_id: '' })
        setShowForm(false)
        fetchActivities()
        fetchPending()
      }
    } finally { setCreating(false) }
  }

  async function toggleComplete(activity: Activity) {
    await fetch(`/api/activities/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !activity.completed })
    })
    fetchActivities()
    fetchPending()
  }

  async function deleteActivity(id: string) {
    if (!confirm('Eliminar esta atividade?')) return
    await fetch(`/api/activities/${id}`, { method: 'DELETE' })
    setSelectedActivity(null)
    fetchActivities()
    fetchPending()
  }

  function navigate(direction: number) {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() + direction)
    else if (view === 'day') d.setDate(d.getDate() + direction)
    else d.setDate(d.getDate() + direction * 7)
    setCurrentDate(d)
  }

  async function moveActivity(a: Activity, newStart: Date) {
    const duration = a.due_date && a.end_date
      ? new Date(a.end_date).getTime() - new Date(a.due_date).getTime()
      : null
    const body: Record<string, string> = { due_date: newStart.toISOString() }
    if (duration != null && duration > 0) body.end_date = new Date(newStart.getTime() + duration).toISOString()
    await fetch(`/api/activities/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    fetchActivities()
    fetchPending()
  }

  function openFormAt(start: Date) {
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    setForm(p => ({ ...p, due_date: toLocalInput(start), end_date: toLocalInput(end) }))
    setShowForm(true)
  }

  function goToday() { setCurrentDate(new Date()) }

  function getMonthDays(): Date[] {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = (firstDay.getDay() + 6) % 7
    const start = new Date(firstDay)
    start.setDate(start.getDate() - startOffset)
    const days: Date[] = []
    const totalDays = startOffset + lastDay.getDate()
    const totalCells = Math.ceil(totalDays / 7) * 7
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  function getWeekDays(): Date[] {
    const day = currentDate.getDay()
    const mondayOffset = (day + 6) % 7
    const monday = new Date(currentDate)
    monday.setDate(monday.getDate() - mondayOffset)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  function getActivitiesForDay(date: Date): Activity[] {
    const dayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return activities.filter(a => {
      if (!a.due_date) return false
      const d = new Date(a.due_date)
      const aStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return aStr === dayStr
    })
  }

  const isToday = (d: Date) => {
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }

  const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth()

  const headerTitle = view === 'month'
    ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : view === 'day'
    ? `${WEEKDAYS[(currentDate.getDay() + 6) % 7]}, ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : (() => {
        const days = getWeekDays()
        return `${days[0].getDate()} ${MONTHS[days[0].getMonth()].substring(0, 3)} — ${days[6].getDate()} ${MONTHS[days[6].getMonth()].substring(0, 3)} ${days[6].getFullYear()}`
      })()

  return (
    <div className="page-enter">
      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div className="modal-backdrop" onClick={() => setSelectedActivity(null)}>
          <div className="modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{ACTIVITY_ICONS[selectedActivity.type]}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{selectedActivity.title}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${ACTIVITY_COLORS[selectedActivity.type]}22`, color: ACTIVITY_COLORS[selectedActivity.type], fontWeight: 500 }}>
                    {ACTIVITY_LABELS[selectedActivity.type]}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedActivity(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            {selectedActivity.description && (
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>{selectedActivity.description}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginBottom: 18 }}>
              {selectedActivity.due_date && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--muted)' }}>Data:</span>
                  <span style={{ color: 'var(--text)' }}>{new Date(selectedActivity.due_date).toLocaleString('pt-PT')}</span>
                </div>
              )}
              {selectedActivity.leads && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--muted)' }}>Lead:</span>
                  <Link href={`/leads/${selectedActivity.leads.id}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>{selectedActivity.leads.name}</Link>
                </div>
              )}
              {selectedActivity.people && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--muted)' }}>Pessoa:</span>
                  <Link href={`/people/${selectedActivity.people.id}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>{selectedActivity.people.name}</Link>
                </div>
              )}
              {selectedActivity.users && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--muted)' }}>Agente:</span>
                  <span style={{ color: 'var(--text)' }}>{selectedActivity.users.name}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--muted)' }}>Estado:</span>
                <span style={{ color: selectedActivity.completed ? 'var(--green)' : 'var(--text)' }}>{selectedActivity.completed ? 'Concluída' : 'Pendente'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => toggleComplete(selectedActivity)} className={`btn ${selectedActivity.completed ? 'btn-ghost' : 'btn-primary'}`} style={{ flex: 1 }}>
                {selectedActivity.completed ? 'Reabrir' : '✓ Concluir'}
              </button>
              <button onClick={() => deleteActivity(selectedActivity.id)} className="btn btn-danger">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Activity Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="font-display" style={{ fontSize: 18, margin: 0 }}>Nova Atividade</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['manual', 'audio'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAddMode(m)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: addMode === m ? 'var(--gold-glow)' : 'var(--surface)',
                    color: addMode === m ? 'var(--gold)' : 'var(--muted)',
                    border: addMode === m ? '1px solid var(--gold)' : '1px solid var(--border)',
                  }}
                >
                  {m === 'manual' ? '✍ Manual' : '🎙 Áudio'}
                </button>
              ))}
            </div>
            {addMode === 'audio' && <AudioRecorder entity="activity" onExtracted={applyVoiceActivity} hint="Descreve a atividade em voz alta (tipo, título, descrição) e confirma os dados a seguir. A data fica por preencher manualmente." />}
            {addMode === 'manual' && (
            <form onSubmit={createActivity} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as ActivityType }))}>
                  {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Título</label>
                <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea className="input" style={{ resize: 'vertical', minHeight: 60 }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Data Início</label>
                  <input type="datetime-local" className="input" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Data Fim</label>
                  <input type="datetime-local" className="input" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={creating} className="btn btn-primary" style={{ flex: 1 }}>
                  {creating ? 'A criar...' : '+ Criar Atividade'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Atividades</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{pending.length} pendentes</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input hide-mobile" style={{ width: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">+ Nova Atividade</button>
        </div>
      </div>

      {/* Main two-pane layout */}
      <div className="dashboard-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1 }}>
        {/* Calendar */}
        <div style={{ padding: '20px 24px' }}>
          {/* Calendar Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ width: 32, height: 32, padding: 0 }}>‹</button>
              <h2 className="font-display" style={{ fontSize: 15, margin: 0, minWidth: 160, textAlign: 'center' }}>{headerTitle}</h2>
              <button onClick={() => navigate(1)} className="btn btn-ghost btn-sm" style={{ width: 32, height: 32, padding: 0 }}>›</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={goToday} className="btn btn-ghost btn-sm">Hoje</button>
              <button onClick={() => setView('day')} className={`btn btn-sm ${view === 'day' ? 'btn-primary' : 'btn-ghost'}`}>Dia</button>
              <button onClick={() => setView('week')} className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-ghost'}`}>Semana</button>
              <button onClick={() => setView('month')} className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-ghost'}`}>Mês</button>
            </div>
          </div>

          {/* Monthly View */}
          {view === 'month' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {WEEKDAYS.map(d => (
                  <div key={d} style={{ padding: '10px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {getMonthDays().map((day, idx) => {
                  const dayActivities = getActivitiesForDay(day)
                  return (
                    <div key={idx} className="cal-month-cell" style={{ minHeight: 80, minWidth: 0, padding: '6px 8px', borderBottom: '1px solid var(--border)', borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none', opacity: isCurrentMonth(day) ? 1 : 0.35 }}>
                      <div onClick={() => { setCurrentDate(day); setView('day') }} title="Ver dia" style={{ fontSize: 12, fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? 'var(--gold)' : 'var(--text)', marginBottom: 4, width: 24, height: 24, borderRadius: '50%', background: isToday(day) ? 'var(--gold-glow)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        {day.getDate()}
                      </div>
                      <div className="cal-events" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayActivities.slice(0, 3).map(a => (
                          <div key={a.id} className="cal-event" onClick={() => setSelectedActivity(a)} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, background: `${ACTIVITY_COLORS[a.type]}22`, color: ACTIVITY_COLORS[a.type], cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: a.completed ? 'line-through' : 'none', opacity: a.completed ? 0.5 : 1, ['--dot' as string]: ACTIVITY_COLORS[a.type] }}>
                            {ACTIVITY_ICONS[a.type]} {a.title}
                          </div>
                        ))}
                        {dayActivities.length > 3 && (
                          <div className="cal-more" onClick={() => { setCurrentDate(day); setView('day') }} style={{ fontSize: 9, color: 'var(--muted)', paddingLeft: 5, cursor: 'pointer' }}>+{dayActivities.length - 3} mais</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Vistas Dia e Semana — grelha de horas estilo Google Calendar */}
          {(view === 'week' || view === 'day') && (
            <CalendarTimeGrid
              days={view === 'week' ? getWeekDays() : [currentDate]}
              activities={activities}
              colors={ACTIVITY_COLORS}
              icons={ACTIVITY_ICONS}
              onEventClick={setSelectedActivity}
              onSlotClick={openFormAt}
              onDayHeaderClick={view === 'week' ? (day) => { setCurrentDate(day); setView('day') } : undefined}
              onEventMove={moveActivity}
            />
          )}
        </div>

        {/* Pending Sidebar */}
        <div className="activities-pending-sidebar" style={{ borderLeft: '1px solid var(--border)', padding: '20px 16px', background: 'var(--surface)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
            Pendentes ({pending.length})
          </div>
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.map(a => {
              const isOverdue = a.due_date && new Date(a.due_date) < new Date()
              return (
                <div key={a.id} onClick={() => setSelectedActivity(a)} className="card card-hover" style={{ display: 'flex', gap: 8, padding: '10px 12px', border: `1px solid ${isOverdue ? 'rgba(220,38,38,0.25)' : 'var(--border)'}`, cursor: 'pointer', alignItems: 'start' }}>
                  <div onClick={e => { e.stopPropagation(); toggleComplete(a) }} style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border-strong)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: `${ACTIVITY_COLORS[a.type]}22`, color: ACTIVITY_COLORS[a.type], fontWeight: 500 }}>
                        {ACTIVITY_LABELS[a.type]}
                      </span>
                      {a.due_date && (
                        <span style={{ fontSize: 10, color: isOverdue ? 'var(--red)' : 'var(--muted)' }}>
                          {new Date(a.due_date).toLocaleDateString('pt-PT')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {pending.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Tudo em dia! ✓</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
