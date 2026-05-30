'use client'
import { useState, useEffect, useCallback } from 'react'
import { Activity, ActivityType } from '@/types'
import Link from 'next/link'

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  chamada: '#3B82F6',
  visita: '#F59E0B',
  email: '#8B5CF6',
  reuniao: '#10B981',
  tarefa: '#EF4444',
  nota: '#6B7280',
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  chamada: '📞',
  visita: '🏠',
  email: '✉',
  reuniao: '🤝',
  tarefa: '✓',
  nota: '📝',
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  chamada: 'Chamada',
  visita: 'Visita',
  email: 'Email',
  reuniao: 'Reunião',
  tarefa: 'Tarefa',
  nota: 'Nota',
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type ViewMode = 'month' | 'week'

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

  const inputStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

  // Fetch activities for the visible date range
  const fetchActivities = useCallback(async () => {
    let dateFrom: string
    let dateTo: string

    if (view === 'month') {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      // Extend to cover the full calendar grid (prev/next month days)
      const startOffset = (firstDay.getDay() + 6) % 7
      const start = new Date(firstDay)
      start.setDate(start.getDate() - startOffset)
      const end = new Date(lastDay)
      end.setDate(end.getDate() + (6 - ((lastDay.getDay() + 6) % 7)))
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

  // Fetch pending activities (no date filter, just uncompleted)
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
          due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
          end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
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

  // Navigation
  function navigate(direction: number) {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() + direction)
    else d.setDate(d.getDate() + direction * 7)
    setCurrentDate(d)
  }

  function goToday() {
    setCurrentDate(new Date())
  }

  // Monthly calendar helpers
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
    const dayStr = date.toISOString().split('T')[0]
    return activities.filter(a => {
      if (!a.due_date) return false
      return a.due_date.split('T')[0] === dayStr
    })
  }

  const isToday = (d: Date) => {
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }

  const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth()

  const headerTitle = view === 'month'
    ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : (() => {
        const days = getWeekDays()
        return `${days[0].getDate()} ${MONTHS[days[0].getMonth()].substring(0, 3)} — ${days[6].getDate()} ${MONTHS[days[6].getMonth()].substring(0, 3)} ${days[6].getFullYear()}`
      })()

  return (
    <>
      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedActivity(null)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, width: 440, padding: 28 }} onClick={e => e.stopPropagation()}>
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
              <button onClick={() => toggleComplete(selectedActivity)} style={{ ...inputStyle, flex: 1, cursor: 'pointer', textAlign: 'center' as const, background: selectedActivity.completed ? 'var(--surface)' : 'var(--gold)', color: selectedActivity.completed ? 'var(--text)' : '#0D0D0F', border: selectedActivity.completed ? '1px solid var(--border)' : 'none', fontWeight: 600 }}>
                {selectedActivity.completed ? 'Reabrir' : '✓ Concluir'}
              </button>
              <button onClick={() => deleteActivity(selectedActivity.id)} style={{ ...inputStyle, cursor: 'pointer', background: 'rgba(224,92,92,0.1)', color: 'var(--red)', borderColor: 'rgba(224,92,92,0.25)' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Activity Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowForm(false)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, width: 460, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="font-display" style={{ fontSize: 18, margin: 0 }}>Nova Atividade</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={createActivity} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Tipo</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as ActivityType }))} style={{ ...inputStyle, width: '100%' }}>
                  {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Título</label>
                <input style={{ ...inputStyle, width: '100%' }} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Descrição</label>
                <textarea style={{ ...inputStyle, width: '100%', resize: 'vertical', minHeight: 60 }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Data Início</label>
                  <input type="datetime-local" style={{ ...inputStyle, width: '100%' }} value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Data Fim</label>
                  <input type="datetime-local" style={{ ...inputStyle, width: '100%' }} value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ ...inputStyle, flex: 1, cursor: 'pointer', textAlign: 'center' as const }}>Cancelar</button>
                <button type="submit" disabled={creating} style={{ flex: 1, background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost, sans-serif', fontSize: 13, opacity: creating ? 0.6 : 1 }}>
                  {creating ? 'A criar...' : '+ Criar Atividade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Atividades</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{pending.length} pendentes</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="">Todos os tipos</option>
            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button onClick={() => setShowForm(true)} style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Nova Atividade
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0, flex: 1 }}>
        {/* Calendar */}
        <div style={{ padding: '20px 24px' }}>
          {/* Calendar Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => navigate(-1)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', color: 'var(--text)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <h2 className="font-display" style={{ fontSize: 16, margin: 0, minWidth: 200, textAlign: 'center' }}>{headerTitle}</h2>
              <button onClick={() => navigate(1)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', color: 'var(--text)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={goToday} style={{ ...inputStyle, cursor: 'pointer', fontSize: 11, padding: '6px 12px' }}>Hoje</button>
              <button onClick={() => setView('month')} style={{ ...inputStyle, cursor: 'pointer', fontSize: 11, padding: '6px 12px', background: view === 'month' ? 'var(--gold)' : 'var(--card)', color: view === 'month' ? '#0D0D0F' : 'var(--text)', border: view === 'month' ? 'none' : '1px solid var(--border)', fontWeight: view === 'month' ? 600 : 400 }}>Mês</button>
              <button onClick={() => setView('week')} style={{ ...inputStyle, cursor: 'pointer', fontSize: 11, padding: '6px 12px', background: view === 'week' ? 'var(--gold)' : 'var(--card)', color: view === 'week' ? '#0D0D0F' : 'var(--text)', border: view === 'week' ? 'none' : '1px solid var(--border)', fontWeight: view === 'week' ? 600 : 400 }}>Semana</button>
            </div>
          </div>

          {/* Monthly View */}
          {view === 'month' && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {WEEKDAYS.map(d => (
                  <div key={d} style={{ padding: '10px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {getMonthDays().map((day, idx) => {
                  const dayActivities = getActivitiesForDay(day)
                  return (
                    <div key={idx} style={{ minHeight: 80, padding: '6px 8px', borderBottom: '1px solid var(--border)', borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none', opacity: isCurrentMonth(day) ? 1 : 0.35 }}>
                      <div style={{ fontSize: 12, fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? 'var(--gold)' : 'var(--text)', marginBottom: 4, width: 24, height: 24, borderRadius: '50%', background: isToday(day) ? 'var(--gold-glow)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {day.getDate()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayActivities.slice(0, 3).map(a => (
                          <div key={a.id} onClick={() => setSelectedActivity(a)} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, background: `${ACTIVITY_COLORS[a.type]}22`, color: ACTIVITY_COLORS[a.type], cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: a.completed ? 'line-through' : 'none', opacity: a.completed ? 0.5 : 1 }}>
                            {ACTIVITY_ICONS[a.type]} {a.title}
                          </div>
                        ))}
                        {dayActivities.length > 3 && (
                          <div style={{ fontSize: 9, color: 'var(--muted)', paddingLeft: 5 }}>+{dayActivities.length - 3} mais</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Weekly View */}
          {view === 'week' && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {getWeekDays().map((day, idx) => {
                const dayActivities = getActivitiesForDay(day)
                return (
                  <div key={idx} style={{ display: 'flex', borderBottom: idx < 6 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 80, padding: '12px 14px', borderRight: '1px solid var(--border)', flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{WEEKDAYS[idx]}</div>
                      <div style={{ fontSize: 20, fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? 'var(--gold)' : 'var(--text)' }}>{day.getDate()}</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 60 }}>
                      {dayActivities.map(a => (
                        <div key={a.id} onClick={() => setSelectedActivity(a)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: `${ACTIVITY_COLORS[a.type]}11`, cursor: 'pointer', opacity: a.completed ? 0.5 : 1 }}>
                          <span style={{ fontSize: 12 }}>{ACTIVITY_ICONS[a.type]}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', textDecoration: a.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                            {a.due_date && (
                              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                {new Date(a.due_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                {a.leads && <span> · {a.leads.name}</span>}
                              </div>
                            )}
                          </div>
                          <div onClick={e => { e.stopPropagation(); toggleComplete(a) }} style={{ width: 16, height: 16, borderRadius: 4, border: a.completed ? 'none' : '1.5px solid var(--border)', background: a.completed ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#0D0D0F', fontSize: 10 }}>
                            {a.completed ? '✓' : ''}
                          </div>
                        </div>
                      ))}
                      {dayActivities.length === 0 && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.5, padding: '8px 0' }}>Sem atividades</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pending Sidebar */}
        <div style={{ borderLeft: '1px solid var(--border)', padding: '20px 16px', background: 'var(--surface)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
            Pendentes ({pending.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.map(a => {
              const isOverdue = a.due_date && new Date(a.due_date) < new Date()
              return (
                <div key={a.id} onClick={() => setSelectedActivity(a)} style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--card)', border: `1px solid ${isOverdue ? 'rgba(224,92,92,0.3)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', alignItems: 'start' }}>
                  <div onClick={e => { e.stopPropagation(); toggleComplete(a) }} style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
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
              <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Tudo em dia!</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
