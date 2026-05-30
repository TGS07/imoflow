# Activities & Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify contacts and tasks into a single "Activity" entity with calendar integration, replacing the separate sections in lead detail.

**Architecture:** New `activities` table with RLS, REST API endpoints, a calendar page with monthly/weekly views + pending list, unified activities section in lead detail replacing contacts/tasks, and a dashboard widget for today's activities.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + RLS), React 19, TypeScript, CSS-in-JS inline styles with CSS variables.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260530_activities.sql` | DB table, indexes, RLS policy, data migration |
| `types/activity.ts` | ActivityType and Activity type definitions |
| `app/api/activities/route.ts` | GET (list with filters) + POST (create) |
| `app/api/activities/[id]/route.ts` | GET (detail) + PATCH (edit/complete) + DELETE |
| `app/(app)/activities/page.tsx` | Calendar page with monthly/weekly/pending views |

### Modified Files
| File | Change |
|------|--------|
| `types/index.ts` | Re-export from `types/activity.ts` |
| `components/layout/Sidebar.tsx` | Add "Atividades" nav item |
| `app/(app)/leads/[id]/page.tsx` | Replace contacts+tasks with unified activities section |
| `app/(app)/dashboard/page.tsx` | Add "Atividades de Hoje" widget + pending count stat |

---

## Activity Type Colors (Reference)

```typescript
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
```

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260530_activities.sql`

- [ ] **Step 1: Write the migration SQL**

Create file `supabase/migrations/20260530_activities.sql`:

```sql
-- Activities table
CREATE TABLE public.activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  person_id     UUID REFERENCES people(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES users(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('chamada','visita','email','reuniao','tarefa','nota')),
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  completed     BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX activities_agency_idx ON activities(agency_id);
CREATE INDEX activities_lead_idx ON activities(lead_id);
CREATE INDEX activities_due_idx ON activities(agency_id, due_date);
CREATE INDEX activities_assigned_idx ON activities(assigned_to, completed);

-- RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_agency_isolation" ON activities
  FOR ALL
  USING (agency_id = get_my_agency_id())
  WITH CHECK (agency_id = get_my_agency_id());

-- Migrate contacts → activities
INSERT INTO activities (agency_id, lead_id, assigned_to, type, title, description, due_date, completed, created_at)
SELECT l.agency_id, c.lead_id, c.user_id, c.type, c.title, c.description, c.created_at, true, c.created_at
FROM contacts c
JOIN leads l ON l.id = c.lead_id;

-- Migrate tasks → activities
INSERT INTO activities (agency_id, lead_id, assigned_to, type, title, due_date, completed, completed_at, created_at)
SELECT l.agency_id, t.lead_id, t.assigned_to, 'tarefa', t.title, t.due_date::timestamptz, t.completed,
  CASE WHEN t.completed THEN t.created_at END, t.created_at
FROM tasks t
JOIN leads l ON l.id = t.lead_id;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260530_activities.sql
git commit -m "feat: add activities table migration with data migration from contacts/tasks"
```

> **Note:** The user must run this SQL in the Supabase SQL Editor before the API endpoints will work.

---

### Task 2: TypeScript Types

**Files:**
- Create: `types/activity.ts`
- Modify: `types/index.ts`

- [ ] **Step 1: Create the activity types file**

Create file `types/activity.ts`:

```typescript
export type ActivityType = 'chamada' | 'visita' | 'email' | 'reuniao' | 'tarefa' | 'nota'

export type Activity = {
  id: string
  agency_id: string
  lead_id: string | null
  person_id: string | null
  assigned_to: string | null
  type: ActivityType
  title: string
  description: string | null
  due_date: string | null
  end_date: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  users?: { name: string; avatar_initials: string }
  leads?: { id: string; name: string }
  people?: { id: string; name: string }
}
```

- [ ] **Step 2: Re-export from types/index.ts**

Add at the end of `types/index.ts`:

```typescript
export type { ActivityType, Activity } from './activity'
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add types/activity.ts types/index.ts
git commit -m "feat: add ActivityType and Activity type definitions"
```

---

### Task 3: Activities API — List & Create

**Files:**
- Create: `app/api/activities/route.ts`

- [ ] **Step 1: Create the activities list+create API**

Create file `app/api/activities/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const lead_id = searchParams.get('lead_id')
  const person_id = searchParams.get('person_id')
  const type = searchParams.get('type')
  const assigned_to = searchParams.get('assigned_to')
  const completed = searchParams.get('completed')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')

  let query = supabase
    .from('activities')
    .select('*, users:assigned_to(name, avatar_initials), leads(id, name), people(id, name)')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (lead_id) query = query.eq('lead_id', lead_id)
  if (person_id) query = query.eq('person_id', person_id)
  if (type) query = query.eq('type', type)
  if (assigned_to) query = query.eq('assigned_to', assigned_to)
  if (completed) query = query.eq('completed', completed === 'true')
  if (date_from) query = query.gte('due_date', date_from)
  if (date_to) query = query.lte('due_date', date_to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('activities')
    .insert({ ...body, agency_id: profile.agency_id, assigned_to: body.assigned_to ?? user.id })
    .select('*, users:assigned_to(name, avatar_initials), leads(id, name), people(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add app/api/activities/route.ts
git commit -m "feat: add activities list and create API endpoints"
```

---

### Task 4: Activities API — Detail, Update, Delete

**Files:**
- Create: `app/api/activities/[id]/route.ts`

- [ ] **Step 1: Create the activity detail API**

Create file `app/api/activities/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('activities')
    .select('*, users:assigned_to(name, avatar_initials), leads(id, name), people(id, name)')
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Auto-set completed_at when marking as completed
  if (body.completed === true && !body.completed_at) {
    body.completed_at = new Date().toISOString()
  }
  if (body.completed === false) {
    body.completed_at = null
  }

  const { data, error } = await supabase
    .from('activities')
    .update(body)
    .eq('id', id)
    .select('*, users:assigned_to(name, avatar_initials), leads(id, name), people(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add app/api/activities/[id]/route.ts
git commit -m "feat: add activity detail, update, and delete API endpoints"
```

---

### Task 5: Sidebar — Add Atividades Link

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Atividades to navItems**

In `components/layout/Sidebar.tsx`, find the navItems array and add after the `Imóveis` entry:

```typescript
{ href: '/activities', icon: '📅', label: 'Atividades', section: 'Principal' },
```

The resulting navItems should include (in order): Dashboard, Leads, Pipeline, Pessoas, Organizações, Imóveis, **Atividades**, Configurações.

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: add Atividades link to sidebar navigation"
```

---

### Task 6: Calendar Page (`/activities`)

**Files:**
- Create: `app/(app)/activities/page.tsx`

This is the largest task. The page has three views:
1. **Monthly calendar** — grid with day cells showing activity badges
2. **Weekly calendar** — 7-day view with more detail per activity
3. **Pending list** — sidebar panel with uncompleted activities sorted by due_date

- [ ] **Step 1: Create the activities calendar page**

Create file `app/(app)/activities/page.tsx`:

```tsx
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
              <button onClick={() => toggleComplete(selectedActivity)} style={{ ...inputStyle, flex: 1, cursor: 'pointer', textAlign: 'center', background: selectedActivity.completed ? 'var(--surface)' : 'var(--gold)', color: selectedActivity.completed ? 'var(--text)' : '#0D0D0F', border: selectedActivity.completed ? '1px solid var(--border)' : 'none', fontWeight: 600 }}>
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
                <button type="button" onClick={() => setShowForm(false)} style={{ ...inputStyle, flex: 1, cursor: 'pointer', textAlign: 'center' }}>Cancelar</button>
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
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add app/(app)/activities/page.tsx
git commit -m "feat: add activities calendar page with monthly/weekly views and pending sidebar"
```

---

### Task 7: Lead Detail — Replace Contacts & Tasks with Unified Activities

**Files:**
- Modify: `app/(app)/leads/[id]/page.tsx`

This task replaces the separate "Histórico de Contactos" and "Tarefas" sections with a single "Atividades" section. The unified section has:
- Type filter tabs (Todas, Chamadas, Visitas, etc.)
- Inline form to add new activity
- Activity list with type badge, checkbox for completion, and timeline-style display

- [ ] **Step 1: Rewrite the lead detail page**

Replace the full content of `app/(app)/leads/[id]/page.tsx` with:

```tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lead, PipelineStage, Activity, ActivityType } from '@/types'
import { SendEmailModal } from '@/components/leads/SendEmailModal'

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

export default function LeadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [showEmail, setShowEmail] = useState(false)
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
        due_date: newActivity.due_date ? new Date(newActivity.due_date).toISOString() : null,
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
              <div style={{ marginBottom: pendingActivities.length > 0 && completedActivities.length > 0 ? 16 : 0 }}>
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
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add app/(app)/leads/[id]/page.tsx
git commit -m "feat: replace contacts/tasks with unified activities section in lead detail"
```

---

### Task 8: Dashboard — Add Activities Widget & Stat

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

Add two things:
1. A new StatCard showing pending activities count
2. Replace "Atividade Recente" (contacts-based) with "Atividades de Hoje" (activities-based)

- [ ] **Step 1: Update the dashboard page**

In `app/(app)/dashboard/page.tsx`, make these changes:

**a)** Add activities fetch to the Promise.all (add after `stages` query):

```typescript
const [{ data: profile }, { data: leads }, { data: todayActivities }, { data: pendingCount }, { data: stages }] = await Promise.all([
  supabase.from('users').select('name').eq('id', user.id).single(),
  supabase.from('leads').select('id, name, stage_id, typology, zone, budget, deal_value, expected_close_date, created_at, pipeline_stages(id, name, color, probability, is_won, is_lost)').order('created_at', { ascending: false }),
  supabase.from('activities').select('id, type, title, due_date, completed, leads(name), users:assigned_to(name)').gte('due_date', new Date(new Date().setHours(0,0,0,0)).toISOString()).lte('due_date', new Date(new Date().setHours(23,59,59,999)).toISOString()).order('due_date', { ascending: true }),
  supabase.from('activities').select('id', { count: 'exact', head: true }).eq('completed', false),
  supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
])
```

**b)** Replace the stat cards grid — add a 5th stat card for pending activities:

Change the stats grid from `repeat(4, 1fr)` to `repeat(5, 1fr)`:

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
  <StatCard label="Leads Ativos" value={activeLeads} icon="◎" />
  <StatCard label="Pipeline Total" value={formatValue(pipelineTotal)} icon="€" />
  <StatCard label="Pipeline Ponderado" value={formatValue(pipelineWeighted)} icon="◈" />
  <StatCard label="Fechados (mes)" value={closedThisMonth} icon="✓" />
  <StatCard label="Atividades Pendentes" value={pendingCount?.count ?? 0} icon="📅" />
</div>
```

**c)** Replace the "Atividade Recente" sidebar with "Atividades de Hoje":

```tsx
<div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
  <div className="font-display" style={{ fontSize: 15, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    Atividades de Hoje
    <Link href="/activities" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'var(--gold)', fontWeight: 500, textDecoration: 'none' }}>Ver tudo →</Link>
  </div>
  <div>
    {(todayActivities ?? []).map((a: { id: string; type: string; title: string; due_date: string | null; completed: boolean; leads: { name: string } | null; users: { name: string } | null }, i: number) => {
      const typeColors: Record<string, string> = { chamada: '#3B82F6', visita: '#F59E0B', email: '#8B5CF6', reuniao: '#10B981', tarefa: '#EF4444', nota: '#6B7280' }
      const typeIcons: Record<string, string> = { chamada: '📞', visita: '🏠', email: '✉', reuniao: '🤝', tarefa: '✓', nota: '📝' }
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
              {(a.leads as unknown as { name: string } | null)?.name && (
                <span> — <strong style={{ color: 'var(--gold)', fontWeight: 500 }}>{(a.leads as unknown as { name: string }).name}</strong></span>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              {a.due_date ? new Date(a.due_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''}
              {(a.users as unknown as { name: string } | null)?.name && ` · ${(a.users as unknown as { name: string }).name}`}
            </div>
          </div>
        </div>
      )
    })}
    {(todayActivities ?? []).length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem atividades para hoje.</p>}
  </div>
</div>
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add app/(app)/dashboard/page.tsx
git commit -m "feat: add today's activities widget and pending count to dashboard"
```

---

## Self-Review Checklist

### Spec Coverage
| Spec Requirement | Task |
|-----------------|------|
| `activities` table with all fields | Task 1 |
| RLS policy | Task 1 |
| Migration from contacts/tasks | Task 1 |
| TypeScript types | Task 2 |
| GET /api/activities with all filters | Task 3 |
| POST /api/activities | Task 3 |
| GET /api/activities/[id] | Task 4 |
| PATCH /api/activities/[id] with auto completed_at | Task 4 |
| DELETE /api/activities/[id] | Task 4 |
| Sidebar link | Task 5 |
| Calendar page — monthly view | Task 6 |
| Calendar page — weekly view | Task 6 |
| Calendar page — pending list | Task 6 |
| Activity colors per type | Task 6, 7 |
| Lead detail — unified activities | Task 7 |
| Lead detail — type filter tabs | Task 7 |
| Lead detail — inline add form | Task 7 |
| Lead detail — checkbox completion | Task 7 |
| Dashboard — activities widget | Task 8 |
| Dashboard — pending count stat | Task 8 |

### Placeholder Scan
No TBD, TODO, or placeholder text found.

### Type Consistency
- `ActivityType` and `Activity` used consistently across all tasks
- `ACTIVITY_COLORS`, `ACTIVITY_ICONS`, `ACTIVITY_LABELS` maps identical in Tasks 6 and 7
- API endpoint paths consistent: `/api/activities`, `/api/activities/[id]`
- Supabase select includes `users:assigned_to(name, avatar_initials)` consistently
