# Notificações — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de notificações in-app + email para agentes do ImoFlow, com polling a cada 5 minutos e envio imediato por Resend.

**Architecture:** Uma tabela `notifications` no Supabase guarda até 20 notificações por utilizador. Uma função interna `createNotification` é chamada nas API routes existentes e envia email via Resend. O componente `NotificationBell` faz polling a `/api/notifications` a cada 5 minutos e mostra um dropdown com o sininho no header.

**Tech Stack:** Next.js App Router, Supabase (postgres), Resend, React state + fetch nativo, Vercel Cron Jobs.

---

## Mapa de Ficheiros

| Ficheiro | Acção | Responsabilidade |
|----------|-------|------------------|
| `supabase/migrations/20260521_notifications.sql` | Criar | Migração SQL: tabela `notifications` + coluna `email_notifications` |
| `lib/notifications.ts` | Criar | Função `createNotification` — inserir, limpar antigas, enviar email |
| `app/api/notifications/route.ts` | Criar | `GET /api/notifications` |
| `app/api/notifications/[id]/read/route.ts` | Criar | `PATCH /api/notifications/[id]/read` |
| `app/api/notifications/read-all/route.ts` | Criar | `PATCH /api/notifications/read-all` |
| `app/api/cron/task-reminders/route.ts` | Criar | Vercel Cron diário 08:00 — notificações de tarefas com prazo |
| `vercel.json` | Criar | Configurar o cron job |
| `components/layout/NotificationBell.tsx` | Criar | Componente UI: sininho, badge, dropdown, polling |
| `app/api/leads/route.ts` | Modificar | Chamar `createNotification` no POST (nova lead) |
| `app/api/leads/[id]/route.ts` | Modificar | Chamar `createNotification` no PATCH quando `stage` muda |
| `app/api/emails/send/route.ts` | Modificar | Chamar `createNotification` quando email enviado com sucesso |
| `app/(app)/layout.tsx` | Modificar | Adicionar `<NotificationBell />` ao header |

---

## Task 1: Migração de Base de Dados

**Files:**
- Criar: `supabase/migrations/20260521_notifications.sql`

- [ ] **Step 1: Criar o ficheiro de migração**

```sql
-- supabase/migrations/20260521_notifications.sql

-- Tabela de notificações
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  agency_id  uuid not null references agencies(id) on delete cascade,
  type       text not null check (type in ('new_lead','task_due','lead_stage_changed','email_received')),
  title      text not null,
  body       text not null,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on notifications(user_id, created_at desc);

-- Opt-out de email nas notificações
alter table users
  add column if not exists email_notifications boolean not null default true;
```

- [ ] **Step 2: Executar a migração no Supabase**

Vai ao painel do Supabase → SQL Editor → cola o conteúdo do ficheiro acima e executa.

Verifica que a tabela foi criada:
```sql
select * from notifications limit 1;
select email_notifications from users limit 1;
```
Ambas as queries devem retornar sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260521_notifications.sql
git commit -m "feat: add notifications table migration"
```

---

## Task 2: Função `createNotification`

**Files:**
- Criar: `lib/notifications.ts`

- [ ] **Step 1: Criar o ficheiro**

```ts
// lib/notifications.ts
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'

export type NotificationType =
  | 'new_lead'
  | 'task_due'
  | 'lead_stage_changed'
  | 'email_received'

interface CreateNotificationParams {
  userId: string
  agencyId: string
  type: NotificationType
  title: string
  body: string
  link?: string
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { userId, agencyId, type, title, body, link } = params
  const supabase = await createClient()

  // 1. Inserir notificação
  const { error: insertError } = await supabase
    .from('notifications')
    .insert({ user_id: userId, agency_id: agencyId, type, title, body, link })

  if (insertError) {
    console.error('Failed to insert notification:', insertError.message)
    return
  }

  // 2. Apagar as mais antigas se total > 20
  // Busca todos os IDs ordenados do mais recente para o mais antigo
  const { data: allIds } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (allIds && allIds.length > 20) {
    const toDelete = allIds.slice(20).map((r) => r.id)
    await supabase
      .from('notifications')
      .delete()
      .in('id', toDelete)
  }

  // 3. Verificar opt-out e enviar email
  const { data: userRow } = await supabase
    .from('users')
    .select('name, email_notifications')
    .eq('id', userId)
    .single()

  if (!userRow?.email_notifications) return

  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  const toEmail = authUser?.user?.email
  if (!toEmail) return

  try {
    await resend.emails.send({
      from: 'ImoFlow <noreply@imoflow.pt>',
      to: toEmail,
      subject: `[ImoFlow] ${title}`,
      text: [
        `Olá ${userRow.name ?? ''},`,
        '',
        body,
        link ? `\nVer detalhes: https://app.imoflow.pt${link}` : '',
        '',
        '---',
        'ImoFlow · Para desactivar notificações por email, vai a Definições > Notificações.',
      ].join('\n'),
    })
  } catch (err) {
    console.error('Failed to send notification email:', err)
  }
}
```

- [ ] **Step 2: Verificar que compila sem erros**

```bash
npx tsc --noEmit
```

Esperado: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: add createNotification utility"
```

---

## Task 3: `GET /api/notifications`

**Files:**
- Criar: `app/api/notifications/route.ts`

- [ ] **Step 1: Criar o endpoint**

```ts
// app/api/notifications/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unread_count = (data ?? []).filter((n) => !n.read).length

  return NextResponse.json({ notifications: data ?? [], unread_count })
}
```

- [ ] **Step 2: Testar manualmente com o servidor a correr**

```bash
npm run dev
```

Noutro terminal (substitui o cookie de sessão válido):
```bash
curl -s http://localhost:3000/api/notifications \
  -H "Cookie: <session-cookie>" | jq .
```

Esperado: `{ "notifications": [], "unread_count": 0 }`

- [ ] **Step 3: Commit**

```bash
git add app/api/notifications/route.ts
git commit -m "feat: add GET /api/notifications endpoint"
```

---

## Task 4: Endpoints de Marcar como Lido

**Files:**
- Criar: `app/api/notifications/[id]/read/route.ts`
- Criar: `app/api/notifications/read-all/route.ts`

- [ ] **Step 1: Criar `PATCH /api/notifications/[id]/read`**

```ts
// app/api/notifications/[id]/read/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_id', user.id) // garante que só o dono pode marcar

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Criar `PATCH /api/notifications/read-all`**

```ts
// app/api/notifications/read-all/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/api/notifications/[id]/read/route.ts app/api/notifications/read-all/route.ts
git commit -m "feat: add mark-as-read notification endpoints"
```

---

## Task 5: Integrar `createNotification` nas Leads

**Files:**
- Modificar: `app/api/leads/route.ts`
- Modificar: `app/api/leads/[id]/route.ts`

- [ ] **Step 1: Notificar na criação de lead (`POST /api/leads`)**

Substitui o conteúdo de `app/api/leads/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')
  const search = searchParams.get('search')

  let query = supabase
    .from('leads')
    .select('*, users(name, avatar_initials)')
    .order('created_at', { ascending: false })

  if (stage) query = query.eq('stage', stage)
  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }

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
    .from('leads')
    .insert({ ...body, agency_id: profile.agency_id, assigned_to: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notificar o agente atribuído
  await createNotification({
    userId: user.id,
    agencyId: profile.agency_id,
    type: 'new_lead',
    title: `Nova lead: ${data.name}`,
    body: `Foi-te atribuída uma nova lead.${data.phone ? ` Telefone: ${data.phone}` : ''}`,
    link: `/leads/${data.id}`,
  })

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Notificar na mudança de etapa (`PATCH /api/leads/[id]`)**

Substitui o conteúdo de `app/api/leads/[id]/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('leads')
    .select('*, users(name, avatar_initials)')
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

  // Buscar estado anterior para detectar mudança de etapa
  const { data: before } = await supabase
    .from('leads')
    .select('stage, name, assigned_to, agency_id')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('leads')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notificar se a etapa mudou
  if (before && body.stage && body.stage !== before.stage && before.assigned_to && before.agency_id) {
    await createNotification({
      userId: before.assigned_to,
      agencyId: before.agency_id,
      type: 'lead_stage_changed',
      title: `Lead ${before.name} movida para ${body.stage}`,
      body: `A lead ${before.name} foi movida de "${before.stage}" para "${body.stage}".`,
      link: `/leads/${id}`,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/api/leads/route.ts app/api/leads/[id]/route.ts
git commit -m "feat: trigger notifications on lead create and stage change"
```

---

## Task 6: Integrar `createNotification` no Envio de Email

**Files:**
- Modificar: `app/api/emails/send/route.ts`

- [ ] **Step 1: Adicionar notificação quando email é enviado com sucesso**

Substitui o conteúdo de `app/api/emails/send/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id, to_email, subject, body } = await request.json()
  if (!lead_id || !to_email || !subject || !body) {
    return NextResponse.json({ error: 'lead_id, to_email, subject e body são obrigatórios' }, { status: 400 })
  }

  let status: 'sent' | 'failed' = 'sent'
  try {
    await resend.emails.send({
      from: 'ImoFlow <noreply@imoflow.pt>',
      to: to_email,
      subject,
      text: body,
    })
  } catch {
    status = 'failed'
  }

  // Registar em emails_sent
  const { error: logError } = await supabase.from('emails_sent').insert({
    lead_id, sent_by: user.id, subject, body, status
  })
  if (logError) console.error('Failed to log email_sent:', logError.message)

  // Registar no histórico de contactos
  if (status === 'sent') {
    const { error: contactError } = await supabase.from('contacts').insert({
      lead_id,
      user_id: user.id,
      type: 'email',
      title: `Email enviado: ${subject}`,
      description: body,
    })
    if (contactError) console.error('Failed to log contact:', contactError.message)

    // Buscar nome da lead e dados do agente para a notificação
    const { data: lead } = await supabase
      .from('leads')
      .select('name, assigned_to, agency_id')
      .eq('id', lead_id)
      .single()

    if (lead?.assigned_to && lead?.agency_id) {
      await createNotification({
        userId: lead.assigned_to,
        agencyId: lead.agency_id,
        type: 'email_received',
        title: `Email recebido de ${lead.name}`,
        body: `Recebeste um email de ${lead.name}: "${subject}"`,
        link: `/leads/${lead_id}`,
      })
    }
  }

  if (status === 'failed') {
    return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/api/emails/send/route.ts
git commit -m "feat: trigger notification on email sent"
```

---

## Task 7: Cron Job para Tarefas com Prazo

**Files:**
- Criar: `app/api/cron/task-reminders/route.ts`
- Criar: `vercel.json`

- [ ] **Step 1: Criar o endpoint do cron**

```ts
// app/api/cron/task-reminders/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

export async function GET(request: Request) {
  // Verificar token de autorização do Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Buscar todas as tarefas com prazo hoje e não concluídas
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0] // "2026-05-21"

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, lead_id, leads(agency_id)')
    .eq('due_date', dateStr)
    .neq('status', 'completed')

  if (error) {
    console.error('Cron: failed to fetch tasks:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let notified = 0
  for (const task of tasks ?? []) {
    const agencyId = (task.leads as { agency_id: string } | null)?.agency_id
    if (!task.assigned_to || !agencyId) continue

    await createNotification({
      userId: task.assigned_to,
      agencyId,
      type: 'task_due',
      title: `Tarefa com prazo hoje: ${task.title}`,
      body: `A tarefa "${task.title}" vence hoje.`,
      link: task.lead_id ? `/leads/${task.lead_id}` : undefined,
    })
    notified++
  }

  return NextResponse.json({ notified })
}
```

- [ ] **Step 2: Adicionar `CRON_SECRET` ao `.env.local`**

Gera um secret seguro:
```bash
openssl rand -hex 32
```

Adiciona ao `.env.local`:
```
CRON_SECRET=<valor gerado acima>
```

Adiciona também ao painel de Environment Variables do Vercel (Settings → Environment Variables).

- [ ] **Step 3: Criar `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/task-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

> O Vercel Cron usa UTC. Se os utilizadores estão em Portugal (UTC+1 no Inverno, UTC+2 no Verão), ajusta para `0 7 * * *` (Inverno) ou `0 6 * * *` (Verão) para disparar às 08:00 locais. Para simplicidade, usa `0 8 * * *` e aceita variação de ±1h.

- [ ] **Step 4: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/task-reminders/route.ts vercel.json .env.local
git commit -m "feat: add daily cron job for task-due notifications"
```

---

## Task 8: Componente `NotificationBell`

**Files:**
- Criar: `components/layout/NotificationBell.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/layout/NotificationBell.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'new_lead' | 'task_due' | 'lead_stage_changed' | 'email_received'
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

const TYPE_ICONS: Record<Notification['type'], string> = {
  new_lead: '👤',
  task_due: '📋',
  lead_stage_changed: '🔄',
  email_received: '✉️',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  return `há ${Math.floor(hours / 24)}d`
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch {
      // silencioso — não bloquear a UI por falha de rede
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000) // 5 minutos
    return () => clearInterval(interval)
  }, [])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markAsRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  async function markAllAsRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) await markAsRead(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.25rem',
          position: 'relative',
          padding: '4px 8px',
        }}
        aria-label="Notificações"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: '#ef4444',
            color: 'white',
            borderRadius: '9999px',
            fontSize: '0.65rem',
            fontWeight: 700,
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 8px)',
          width: '340px',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 50,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notificações</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: '#6366f1',
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                Sem notificações
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '12px 16px',
                    width: '100%',
                    textAlign: 'left',
                    background: n.read ? 'white' : '#f0f9ff',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{TYPE_ICONS[n.type]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: n.read ? 400 : 600, fontSize: '0.85rem', color: '#111827' }}>
                      {n.title}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.body}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/layout/NotificationBell.tsx
git commit -m "feat: add NotificationBell component with polling"
```

---

## Task 9: Integrar `NotificationBell` no Layout

**Files:**
- Modificar: `app/(app)/layout.tsx`

- [ ] **Step 1: Adicionar o sininho ao layout**

Substitui o conteúdo de `app/(app)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { NotificationBell } from '@/components/layout/NotificationBell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, avatar_initials')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      <Sidebar
        userName={profile?.name ?? user.email ?? ''}
        userInitials={profile?.avatar_initials ?? 'XX'}
      />
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid #e5e7eb',
          background: 'white',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          <NotificationBell />
        </header>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Testar visualmente no browser**

```bash
npm run dev
```

Abre `http://localhost:3000`. Deves ver o sininho 🔔 no canto superior direito. Clica nele — deve aparecer "Sem notificações".

- [ ] **Step 3: Teste de ponta a ponta**

1. Cria uma nova lead via UI ou via `POST /api/leads`
2. Aguarda até 5 minutos (ou refresca o browser) — o badge vermelho deve aparecer
3. Clica no sininho → vê a notificação "Nova lead: ..."
4. Clica na notificação → navega para `/leads/[id]` e a notificação fica a fundo branco (lida)
5. Clica "Marcar todas como lidas" → badge desaparece

- [ ] **Step 4: Commit final**

```bash
git add app/(app)/layout.tsx
git commit -m "feat: integrate NotificationBell into app layout"
```

---

## Verificação Final

- [ ] `npx tsc --noEmit` — sem erros de tipo
- [ ] `npm run build` — build de produção sem erros
- [ ] Sininho visível em todas as páginas da app
- [ ] Badge aparece após criar uma lead
- [ ] Clicar na notificação navega para a lead correcta
- [ ] "Marcar todas como lidas" limpa o badge
- [ ] Confirmar no Supabase que a tabela `notifications` tem registos
