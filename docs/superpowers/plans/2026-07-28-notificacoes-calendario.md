# Sincronização Seletiva de Notificações com o Calendário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toggle opt-in por contacto/lead ("Adicionar notificações ao calendário") que espelha as notificações de acompanhamento e de avisos de etapa como `activities`, mais um feed ICS privado por utilizador (`/api/calendar/<token>.ics`) para subscrever num calendário externo (Notion Calendar, Google Calendar, Apple Calendar).

**Architecture:** Reaproveita a tabela `activities` existente como única fonte de eventos — zero tabela nova. Um helper partilhado (`mirrorNotificationToCalendar`) é chamado nos dois pontos reais onde o código cria notificações "agendadas" (cron `contact-followup` e o ramo `send_notification` do motor de automações, usado pelos avisos de etapa); verifica `calendar_sync_enabled` e cria a `activity` de forma idempotente (`notification_id` único). O feed ICS é gerado ao vivo (sem tabela própria) a partir de `activities` filtradas por `source = 'notification'` e pelo dono do token — sem sessão, autenticado só pelo token na URL.

**Tech Stack:** Next.js 16 (rotas com `params: Promise<...>`), React 19, Supabase (Postgres + RLS). **Sem framework de testes** — verificação é `npx tsc --noEmit` + `npm run build` + preview manual / `curl`. Branch: continuar em `claude/notifications-contacts-calendar-9f9f44` (já é o branch ativo neste worktree — sem criar branch nova).

**Spec:** `docs/superpowers/specs/2026-07-28-notificacoes-calendario-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260728_calendar_sync.sql` | Criar | `calendar_sync_enabled` (people/leads), `calendar_token` (users), `source`/`notification_id` (activities) + índice único parcial |
| `types/index.ts` | Modificar | `calendar_sync_enabled` em `Person` e `Lead` |
| `types/activity.ts` | Modificar | `source`/`notification_id` em `Activity` |
| `lib/calendar/ics.ts` | Criar | Gerador puro do feed ICS (sem dependências externas) |
| `lib/calendar/mirror-notification.ts` | Criar | Espelha uma notificação numa `activity`, idempotente |
| `lib/notifications.ts` | Modificar | `createNotification` passa a devolver `{ id } \| null` |
| `app/api/cron/contact-followup/route.ts` | Modificar | Chama `mirrorNotificationToCalendar` nos 2 pontos de `createNotification` |
| `lib/automations/engine.ts` | Modificar | Chama `mirrorNotificationToCalendar` no ramo `send_notification`, só para gatilhos de aviso de etapa |
| `app/api/calendar/[token]/route.ts` | Criar | Feed ICS público, autenticado por token |
| `app/api/users/me/calendar-token/route.ts` | Criar | GET (ler) / POST (regenerar) o token pessoal |
| `app/api/people/[id]/route.ts` | Modificar | Allowlist do PATCH ganha `calendar_sync_enabled` |
| `components/profile/CalendarFeedCard.tsx` | Criar | Cartão com URL do feed, copiar, regenerar |
| `app/(app)/profile/page.tsx` | Criar | Página de perfil pessoal (fora de `/settings`, sem gate de admin) |
| `components/layout/Sidebar.tsx` | Modificar | Rodapé do utilizador liga a `/profile` |
| `components/contacts/ContactDetailPanel.tsx` | Modificar | Toggle "Adicionar ao calendário" na secção Acompanhamento |
| `app/(app)/leads/[id]/page.tsx` | Modificar | Toggle equivalente, sempre visível, na ficha do lead |
| `app/(app)/activities/page.tsx` | Modificar | Ícone de sino nas atividades com `source = 'notification'` |

## Factos do código (verificados — não re-descobrir)

- **`activities.type` já tem um CHECK constraint fechado**: `'chamada','visita','email','reuniao','tarefa','nota','whatsapp'` (última alteração em `20260611_whatsapp_and_agency_email.sql`). Os tipos `'follow_up'`/`'pipeline_stage'` sugeridos no rascunho da spec **não existem** e criá-los obrigaria a alterar o CHECK e os `Record<ActivityType, ...>` em `app/(app)/activities/page.tsx`. Decisão: reaproveitar `'tarefa'` para todas as atividades espelhadas; a distinção visual vem de `source = 'notification'` (já previsto na secção Interface da spec, ponto 4), não de um tipo novo.
- **Os avisos de etapa NÃO chamam `createNotification()` diretamente no cron `stage-notifications`.** Esse cron só decide *se* uma regra pode corresponder e depois chama `triggerAutomations()` (`lib/automations/engine.ts`), que executa `executeAction()`; é o ramo `if (rule.action_type === 'send_notification')` dentro de `executeAction` que efetivamente chama `createNotification()` (engine.ts, função `executeAction`, ~linha 199). É **aí** que a espelhagem tem de ser ligada — não no ficheiro do cron, que nunca vê a notificação.
- **`send_notification` é partilhado por gatilhos fora do âmbito da spec.** `StageNotificationsModal.tsx` cria sempre regras com `action_type: 'send_notification'`, mas para 4 `trigger_type` diferentes: `stage_changed` (com `trigger_config.to_stage_id`), `lead_inactive`, `stage_days_after_entry`, `stage_recurring`. Existem também outros `trigger_type` (`lead_created`, `activity_completed`, `whatsapp_message_received`) configuráveis livremente em `/settings/automations` que também podem usar `action_type: 'send_notification'` — esses não são "avisos de etapa" e não fazem sentido como evento de calendário com data. **Decisão:** espelhar só quando `rule.trigger_type` está na lista `STAGE_WARNING_TRIGGERS = ['stage_changed', 'lead_inactive', 'stage_days_after_entry', 'stage_recurring']` — exatamente os 4 gatilhos que o editor de notificações da etapa usa.
- **`/settings/*` tem gate de admin**: `app/(app)/settings/layout.tsx` faz `redirect('/dashboard')` se `profile.role !== 'admin'`. O link do feed ICS pessoal é para **todos** os utilizadores (admin e agente), por isso não pode viver em `/settings`. Decisão: nova página `app/(app)/profile/page.tsx`, fora do grupo `/settings`, sem gate de role — só exige sessão.
- **Não existe modal/painel de detalhe de lead em `components/pipeline/`.** A ficha completa do lead é a página `app/(app)/leads/[id]/page.tsx` (626 linhas); clicar num card do Kanban faz `router.push('/leads/${lead.id}')` (`components/pipeline/KanbanBoard.tsx:63,184`). O cartão "Frequência de follow-up" já existe nessa página (linhas ~366-381) mas só aparece quando `!lead.people && lead.is_regular` (porque, quando há contacto ligado, a cadência é gerida na ficha do contacto). O toggle `calendar_sync_enabled` do lead é **independente** disso (a spec exige toggles independentes contacto/lead) e os avisos de etapa disparam mesmo sem `is_regular` — por isso o novo cartão fica **sempre visível**, sem essas duas condições.
- **`PATCH /api/people/[id]` usa uma allowlist explícita** (`const allowed = [...]`, linhas 34-36) — é preciso acrescentar `'calendar_sync_enabled'` à lista, senão o PATCH ignora o campo silenciosamente. **`PATCH /api/leads/[id]` faz passthrough direto** (`supabase.from('leads').update(leadData)`, sem allowlist) — `calendar_sync_enabled` passa sem qualquer alteração de código nessa rota.
- **RLS de `users`** é `for all using (agency_id = get_my_agency_id())` — em teoria, qualquer colega de agência consegue ler a coluna `calendar_token` de outro colega através do cliente de sessão, se algum código alguma vez a incluir num select amplo. Mitigação: nunca selecionar `calendar_token` fora dos endpoints `/api/users/me/calendar-token` (que filtram sempre por `id = user.id` do utilizador autenticado). Todas as rotas existentes que listam `users` (`app/api/team/route.ts`, `app/(app)/layout.tsx`, etc.) já usam listas de colunas explícitas — nenhuma faz `select('*')` em `users` — por isso não há risco de fuga acidental hoje.
- **`createNotification()` (`lib/notifications.ts`) devolve atualmente `void`.** Passa a devolver `{ id: string } | null` para os chamadores que precisam do id da notificação para a espelhar em `activities.notification_id`. Há 8 chamadores no código (`app/api/leads/route.ts`, `app/api/leads/[id]/route.ts`, `app/api/emails/send/route.ts`, `app/api/cron/contact-followup/route.ts` ×2, `app/api/cron/task-reminders/route.ts`, `app/api/cron/seller-inactive/route.ts`, `lib/automations/engine.ts`) e nenhum usa o valor de retorno — mudar de `void` para `{id}|null` é compatível com todos, sem precisar de os tocar (só os dois de `contact-followup` e o de `engine.ts` ganham o `mirrorNotificationToCalendar` a seguir).
- **Segmentos dinâmicos do Next.js fazem match a UM segmento de path inteiro** (`app/blog/[slug]/page.js` → `/blog/a`); não há suporte documentado para misturar texto literal fora dos colchetes no nome da pasta (confirmado em `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`). Por isso a rota ICS fica em `app/api/calendar/[token]/route.ts`, e o parâmetro `token` recebido é literalmente `"<uuid>.ics"` para o pedido `GET /api/calendar/<uuid>.ics`; o sufixo `.ics` é removido em código antes de consultar a BD.
- **Sem framework de testes no projeto** — confirmado: sem `jest`/`vitest` em `package.json`, sem pasta `tests/`, sem config. `package.json` só tem os scripts `dev`, `build`, `start`, `lint`. Segue-se o padrão dos planos anteriores deste repositório (ex. `2026-07-19-imovel-comprador.md`, `2026-07-27-card-hover-preview.md`): verificação via `npx tsc --noEmit` + `npm run build` + preview manual/`curl`, sem introduzir um test runner novo.
- `ContactDetailPanel.tsx` já tem o padrão exato para toggles rápidos fora do modo de edição: `toggleRegular()`/`toggleSpecial()` (linhas 137-171) fazem `fetch(PATCH) → fetchPerson() → onChanged?.()`. O toggle de calendário segue o mesmo padrão.
- `app/(app)/leads/[id]/page.tsx` tem o mesmo padrão: `toggleRegular()` (linhas 149-154) faz `setLead(optimistic) → fetch(PATCH)`.
- A tabela `notifications` tem `id uuid primary key default gen_random_uuid()` (`20260521_notifications.sql`).

---

### Task 1: Migração, tipos e helpers puros do calendário

**Files:**
- Create: `supabase/migrations/20260728_calendar_sync.sql`
- Modify: `types/index.ts`
- Modify: `types/activity.ts`
- Create: `lib/calendar/ics.ts`
- Create: `lib/calendar/mirror-notification.ts`

- [ ] **Step 1: Migração** (ficheiro apenas — aplicada via MCP na Task 7)

Conteúdo completo de `supabase/migrations/20260728_calendar_sync.sql`:

```sql
-- Sincronização seletiva de notificações com o calendário: toggle por
-- contacto/lead + feed ICS privado por utilizador. Ver
-- docs/superpowers/specs/2026-07-28-notificacoes-calendario-design.md.

alter table public.people add column calendar_sync_enabled boolean not null default false;
alter table public.leads  add column calendar_sync_enabled boolean not null default false;

-- Token opaco do feed ICS pessoal. Nunca é exposto a outros utilizadores;
-- só o próprio utilizador o vê/copia em /profile (ver
-- app/api/users/me/calendar-token/route.ts). Não incluir esta coluna em
-- selects amplos de `users` fora desse endpoint.
alter table public.users add column calendar_token uuid not null default gen_random_uuid();

-- Distingue atividades manuais de atividades espelhadas automaticamente a
-- partir de uma notificação (cron contact-followup / avisos de etapa via
-- lib/automations/engine.ts). notification_id evita duplicação ao
-- reexecutar os crons.
alter table public.activities
  add column source text not null default 'manual' check (source in ('manual', 'notification')),
  add column notification_id uuid references public.notifications(id) on delete cascade;

-- Rede de segurança contra corridas entre execuções do cron: garante que
-- nunca existe mais que uma activity por notification_id (o código já
-- verifica isto antes de inserir, isto é só a garantia ao nível da BD).
create unique index activities_notification_unique_idx
  on public.activities(notification_id) where notification_id is not null;
```

- [ ] **Step 2: Tipos `Person` e `Lead`** — em `types/index.ts`, no tipo `Person` (linha 68), a seguir a `regular_interval_days: number | null` (linha 82), acrescentar:

```ts
  calendar_sync_enabled: boolean
```

E no tipo `Lead` (linha 142), a seguir a `regular_interval_days: number | null` (linha 163), acrescentar a mesma linha:

```ts
  calendar_sync_enabled: boolean
```

- [ ] **Step 3: Tipo `Activity`** — conteúdo completo de `types/activity.ts` (acrescenta `source` e `notification_id` a seguir a `completed_at`):

```ts
export type ActivityType = 'chamada' | 'visita' | 'email' | 'reuniao' | 'tarefa' | 'nota' | 'whatsapp'

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
  source: 'manual' | 'notification'
  notification_id: string | null
  created_at: string
  users?: { name: string; avatar_initials: string }
  leads?: { id: string; name: string }
  people?: { id: string; name: string }
}
```

- [ ] **Step 4: Gerador ICS puro** — conteúdo completo de `lib/calendar/ics.ts`:

```ts
// lib/calendar/ics.ts
// Gerador puro do feed ICS (RFC 5545, subconjunto mínimo VEVENT). Sem
// dependências externas — o formato é simples e não há nenhuma lib "ics" já
// instalada no projeto (ver docs/superpowers/specs/2026-07-28-notificacoes-calendario-design.md).

export type IcsEvent = {
  id: string
  title: string
  description: string
  dueDate: string // ISO 8601
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function formatIcsDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

// VCALENDAR com um VEVENT por atividade. Usa quebras de linha CRLF, como
// exige a RFC 5545 — a maioria dos clientes tolera LF, mas seguimos a spec
// à letra para evitar problemas de parsing no Notion/Google/Apple Calendar.
export function buildIcsFeed(events: IcsEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ImoFlow//Calendario de Notificacoes//PT',
    'CALSCALE:GREGORIAN',
  ]

  const stamp = formatIcsDate(new Date().toISOString())
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@imoflow.pt`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsDate(event.dueDate)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
```

- [ ] **Step 5: Verificação rápida do gerador ICS** (sem test runner — script descartável)

Criar um ficheiro descartável `scripts/_verify-ics.ts` (fica no repo só até ao fim deste step):

```ts
import { buildIcsFeed } from '../lib/calendar/ics'

const out = buildIcsFeed([
  { id: 'a1', title: 'Acompanhamento: João, Silva', description: 'Ver no ImoFlow: https://app.imoflow.pt/people/1', dueDate: new Date().toISOString() },
])
console.log(out)
console.log('BEGIN:VEVENT count =', (out.match(/BEGIN:VEVENT/g) || []).length)
console.log('has CRLF =', out.includes('\r\n'))
```

Correr e depois apagar:

```bash
npx tsx scripts/_verify-ics.ts
rm scripts/_verify-ics.ts
```

Esperado: imprime um `VCALENDAR` válido, `BEGIN:VEVENT count = 1`, `has CRLF = true`, e a vírgula em "João, Silva" aparece escapada como `João\, Silva` no `SUMMARY`. Se `npx tsx` não estiver instalado localmente, corre na mesma via `npx` (descarrega-o só para este comando, sem ficar como dependência do projeto).

- [ ] **Step 6: Helper de espelhagem, idempotente** — conteúdo completo de `lib/calendar/mirror-notification.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type MirrorTarget =
  | { kind: 'person'; id: string }
  | { kind: 'lead'; id: string }

interface MirrorNotificationParams {
  supabase: SupabaseClient
  agencyId: string
  assignedTo: string
  notificationId: string
  title: string
  target: MirrorTarget
}

// Depois de criar uma notificação de acompanhamento (cron contact-followup)
// ou de aviso de etapa (lib/automations/engine.ts, ramo send_notification),
// espelha-a como uma `activity` — tipo 'tarefa' reaproveitado; a distinção
// visual é feita por `source`, não por um tipo novo — SE o contacto/lead
// alvo tiver `calendar_sync_enabled = true`.
//
// Idempotente: nunca cria uma segunda activity para a mesma
// notification_id (protege contra reexecução do cron). A verificação
// prévia evita a maioria dos casos; o índice único parcial
// `activities_notification_unique_idx` (migração 20260728_calendar_sync.sql)
// é a rede de segurança contra corridas entre execuções.
export async function mirrorNotificationToCalendar(params: MirrorNotificationParams): Promise<void> {
  const { supabase, agencyId, assignedTo, notificationId, title, target } = params

  const table = target.kind === 'person' ? 'people' : 'leads'
  const { data: row } = await supabase
    .from(table)
    .select('calendar_sync_enabled')
    .eq('id', target.id)
    .maybeSingle()

  if (!row?.calendar_sync_enabled) return

  const { data: existing } = await supabase
    .from('activities')
    .select('id')
    .eq('notification_id', notificationId)
    .maybeSingle()

  if (existing) return

  const { error } = await supabase.from('activities').insert({
    agency_id: agencyId,
    lead_id: target.kind === 'lead' ? target.id : null,
    person_id: target.kind === 'person' ? target.id : null,
    assigned_to: assignedTo,
    type: 'tarefa',
    title,
    due_date: new Date().toISOString(),
    completed: false,
    source: 'notification',
    notification_id: notificationId,
  })

  // 23505 = unique_violation — outra execução já espelhou esta notificação
  // entretanto (corrida entre crons); não é um erro real, ignorar.
  if (error && (error as { code?: string }).code !== '23505') {
    console.error('Failed to mirror notification to calendar:', error.message)
  }
}
```

- [ ] **Step 7: Type-check e commit**

```bash
npx tsc --noEmit
git add supabase/migrations/20260728_calendar_sync.sql types/index.ts types/activity.ts lib/calendar/ics.ts lib/calendar/mirror-notification.ts
git commit -m "feat: modelo de dados e helpers puros da sincronização com o calendário"
```

---

### Task 2: Espelhar notificações em atividades (cron + motor de automações)

**Files:**
- Modify: `lib/notifications.ts`
- Modify: `app/api/cron/contact-followup/route.ts`
- Modify: `lib/automations/engine.ts`

- [ ] **Step 1: `createNotification` devolve o id inserido** — conteúdo completo de `lib/notifications.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram/send'

export type NotificationType =
  | 'new_lead'
  | 'task_due'
  | 'lead_stage_changed'
  | 'email_received'
  | 'automation_rule_triggered'
  | 'special_date'

interface CreateNotificationParams {
  userId: string
  agencyId: string
  type: NotificationType
  title: string
  body: string
  link?: string
}

export async function createNotification(params: CreateNotificationParams, client?: SupabaseClient): Promise<{ id: string } | null> {
  const { userId, agencyId, type, title, body, link } = params
  const supabase = client ?? await createClient()

  // 1. Inserir notificação
  const { data: notification, error: insertError } = await supabase
    .from('notifications')
    .insert({ user_id: userId, agency_id: agencyId, type, title, body, link })
    .select('id')
    .single()

  if (insertError || !notification) {
    console.error('Failed to insert notification:', insertError?.message)
    return null
  }

  // 2. Apagar as mais antigas se total > 20
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

  // 3. Buscar dados do utilizador para email + Telegram
  const { data: userRow } = await supabase
    .from('users')
    .select('name, email_notifications, telegram_chat_id')
    .eq('id', userId)
    .single()

  // 3a. Telegram (não bloqueia o envio de email nem é bloqueado por ele)
  if (userRow?.telegram_chat_id && isTelegramConfigured()) {
    try {
      await sendTelegramMessage(
        userRow.telegram_chat_id,
        [`[ImoFlow] ${title}`, '', body, link ? `\nhttps://app.imoflow.pt${link}` : ''].join('\n')
      )
    } catch (err) {
      console.error('Failed to send Telegram notification:', err)
    }
  }

  if (!userRow?.email_notifications) return { id: notification.id }

  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  const toEmail = authUser?.user?.email
  if (!toEmail) return { id: notification.id }

  try {
    await resend.emails.send({
      from: 'ImoFlow <onboarding@resend.dev>',
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

  return { id: notification.id }
}
```

- [ ] **Step 2: Espelhar no cron `contact-followup`** — em `app/api/cron/contact-followup/route.ts`, acrescentar o import a seguir aos existentes:

```ts
import { mirrorNotificationToCalendar } from '@/lib/calendar/mirror-notification'
```

No bloco de follow-ups por inatividade, substituir:

```ts
    await createNotification({
      userId,
      agencyId: it.agency_id,
      type: 'task_due',
      title: `${label} a precisar de contacto: ${it.name}`,
      body: `Já não há contacto com ${it.name} há ${status.daysSince} dias. ${suffix}`,
      link,
    }, supabase)
    processed++
```

por:

```ts
    const notification = await createNotification({
      userId,
      agencyId: it.agency_id,
      type: 'task_due',
      title: `${label} a precisar de contacto: ${it.name}`,
      body: `Já não há contacto com ${it.name} há ${status.daysSince} dias. ${suffix}`,
      link,
    }, supabase)
    if (notification) {
      await mirrorNotificationToCalendar({
        supabase,
        agencyId: it.agency_id,
        assignedTo: userId,
        notificationId: notification.id,
        title: `Acompanhamento: ${it.name}`,
        target: it.kind === 'lead' ? { kind: 'lead', id: it.id } : { kind: 'person', id: it.id },
      })
    }
    processed++
```

No bloco de datas especiais, substituir:

```ts
      await createNotification({
        userId,
        agencyId: sp.agency_id,
        type: 'special_date',
        title: `${icon} ${match.label} hoje: ${sp.name}`,
        body: `Hoje é uma data especial para ${sp.name}. ${suffix}`,
        link,
      }, supabase)
      processed++
```

por:

```ts
      const notification = await createNotification({
        userId,
        agencyId: sp.agency_id,
        type: 'special_date',
        title: `${icon} ${match.label} hoje: ${sp.name}`,
        body: `Hoje é uma data especial para ${sp.name}. ${suffix}`,
        link,
      }, supabase)
      if (notification) {
        await mirrorNotificationToCalendar({
          supabase,
          agencyId: sp.agency_id,
          assignedTo: userId,
          notificationId: notification.id,
          title: `${match.label}: ${sp.name}`,
          target: { kind: 'person', id: sp.id },
        })
      }
      processed++
```

- [ ] **Step 3: Espelhar no motor de automações (avisos de etapa)** — em `lib/automations/engine.ts`, acrescentar o import a seguir aos existentes:

```ts
import { mirrorNotificationToCalendar } from '@/lib/calendar/mirror-notification'
```

A seguir à constante `STAGE_SCOPED_TRIGGERS` (perto do topo do ficheiro), acrescentar:

```ts
// Gatilhos criados exclusivamente pelo editor de notificações da etapa
// (StageNotificationsModal / API pipeline-stages/[id]/notifications) — os
// únicos cujas notificações fazem sentido como evento de calendário. Outros
// gatilhos com action_type 'send_notification' (lead_created,
// activity_completed, whatsapp_message_received, ou um stage_changed criado
// livremente em /settings/automations) ficam de fora.
const STAGE_WARNING_TRIGGERS = ['stage_changed', 'lead_inactive', 'stage_days_after_entry', 'stage_recurring']
```

Dentro de `executeAction`, substituir o ramo:

```ts
  if (rule.action_type === 'send_notification') {
    await createNotification({
      userId: assignedTo,
      agencyId,
      type: 'automation_rule_triggered',
      title: rule.name,
      body: String(config.message ?? rule.name),
      link: `/leads/${leadId}`,
    }, supabase)
    return { notification_sent: true }
  }
```

por:

```ts
  if (rule.action_type === 'send_notification') {
    const notification = await createNotification({
      userId: assignedTo,
      agencyId,
      type: 'automation_rule_triggered',
      title: rule.name,
      body: String(config.message ?? rule.name),
      link: `/leads/${leadId}`,
    }, supabase)
    if (notification && STAGE_WARNING_TRIGGERS.includes(rule.trigger_type)) {
      await mirrorNotificationToCalendar({
        supabase,
        agencyId,
        assignedTo,
        notificationId: notification.id,
        title: `Etapa: ${lead.name}`,
        target: { kind: 'lead', id: leadId },
      })
    }
    return { notification_sent: true }
  }
```

- [ ] **Step 4: Type-check e commit**

```bash
npx tsc --noEmit
git add lib/notifications.ts app/api/cron/contact-followup/route.ts lib/automations/engine.ts
git commit -m "feat: espelhar notificações de acompanhamento e avisos de etapa em activities"
```

---

### Task 3: Feed ICS público

**Files:**
- Create: `app/api/calendar/[token]/route.ts`

- [ ] **Step 1: Rota ICS** — conteúdo completo de `app/api/calendar/[token]/route.ts`:

```ts
import { createServiceClient } from '@/lib/supabase/service'
import { buildIcsFeed } from '@/lib/calendar/ics'
import { NextResponse } from 'next/server'

const ICS_SUFFIX = '.ics'

// Feed ICS privado por utilizador: GET /api/calendar/<token>.ics
// Sem sessão — o token na URL É a autenticação (padrão habitual para feeds
// de calendário privados, tal como Google/Apple Calendar). Âmbito: só as
// atividades do PRÓPRIO utilizador dono do token — mesmo padrão de
// GET /api/notifications, que filtra por user_id e não por agency_id.
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params
  if (!rawToken.endsWith(ICS_SUFFIX)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const token = rawToken.slice(0, -ICS_SUFFIX.length)

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('calendar_token', token)
    .maybeSingle()

  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: activities } = await supabase
    .from('activities')
    .select('id, title, due_date, lead_id, person_id, leads(name), people(name)')
    .eq('source', 'notification')
    .eq('assigned_to', user.id)
    .not('due_date', 'is', null)

  const events = (activities ?? []).map((a) => {
    const target = (a.leads as { name: string } | null) ?? (a.people as { name: string } | null)
    const link = a.lead_id ? `/leads/${a.lead_id}` : a.person_id ? `/people/${a.person_id}` : ''
    return {
      id: a.id as string,
      title: target ? `${a.title}: ${target.name}` : (a.title as string),
      description: link ? `Ver no ImoFlow: https://app.imoflow.pt${link}` : 'Ver no ImoFlow',
      dueDate: a.due_date as string,
    }
  })

  const ics = buildIcsFeed(events)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Type-check e commit**

```bash
npx tsc --noEmit
git add "app/api/calendar/[token]/route.ts"
git commit -m "feat: endpoint do feed ICS público por token"
```

(Verificação com dados reais e token — Task 7.)

---

### Task 4: Link pessoal do feed (API self-service + página de perfil + acesso na sidebar)

**Files:**
- Create: `app/api/users/me/calendar-token/route.ts`
- Create: `components/profile/CalendarFeedCard.tsx`
- Create: `app/(app)/profile/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Rota GET/POST do token pessoal** — conteúdo completo de `app/api/users/me/calendar-token/route.ts`:

```ts
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET devolve o token atual; POST regenera (invalida o link anterior).
// Ambos filtram sempre por id = user.id — nunca expor o token de outro
// utilizador, mesmo que a RLS de `users` permita, em teoria, ler colegas de
// agência (ver "Factos do código" no plano desta funcionalidade).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('calendar_token')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ calendar_token: data.calendar_token })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .update({ calendar_token: randomUUID() })
    .eq('id', user.id)
    .select('calendar_token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ calendar_token: data.calendar_token })
}
```

- [ ] **Step 2: Cartão do feed** — conteúdo completo de `components/profile/CalendarFeedCard.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

export function CalendarFeedCard() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/users/me/calendar-token')
      .then(r => r.ok ? r.json() : null)
      .then((d: { calendar_token: string } | null) => setToken(d?.calendar_token ?? null))
      .finally(() => setLoading(false))
  }, [])

  const url = token && typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/${token}.ics` : ''

  async function copy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerate() {
    if (!confirm('Regenerar o link invalida o link atual — quem o tiver guardado deixa de receber atualizações. Continuar?')) return
    setLoading(true)
    const res = await fetch('/api/users/me/calendar-token', { method: 'POST' })
    const d = await res.json()
    setToken(d.calendar_token)
    setLoading(false)
  }

  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <div>
        <h3 className="font-display" style={{ fontSize: 15, marginBottom: 4 }}>O meu calendário</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Subscreve este link no Notion Calendar, Google Calendar ou Apple Calendar (opção &quot;Subscrever calendário&quot; / &quot;From URL&quot;) para veres, num calendário externo, as notificações dos contactos e leads em que ligaste a sincronização.
        </p>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 36 }} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input readOnly value={url} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)' }} />
            <button type="button" onClick={copy} className="btn btn-ghost btn-sm">{copied ? 'Copiado ✓' : 'Copiar link'}</button>
          </div>
          <button type="button" onClick={regenerate} className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }}>Regenerar link</button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Página de perfil** — conteúdo completo de `app/(app)/profile/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CalendarFeedCard } from '@/components/profile/CalendarFeedCard'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="page-enter page-pad" style={{ padding: '24px 32px' }}>
      <h2 className="font-display" style={{ fontSize: 20, marginBottom: 20 }}>O meu perfil</h2>
      <CalendarFeedCard />
    </div>
  )
}
```

- [ ] **Step 4: Acesso a partir da sidebar** — em `components/layout/Sidebar.tsx`, o rodapé do utilizador (linhas 96-104) é hoje uma `<div>` sem link:

```tsx
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #8B6F30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#FFFFFF', flexShrink: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
          {userInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>{userRole === 'admin' ? 'Administrador' : 'Consultor'}</div>
        </div>
      </div>
```

Substituir por (troca a `div` externa por `Link`, mantendo estilos e conteúdo interno):

```tsx
      <Link href="/profile" onClick={onClose} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #8B6F30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#FFFFFF', flexShrink: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
          {userInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>{userRole === 'admin' ? 'Administrador' : 'Consultor'}</div>
        </div>
      </Link>
```

`Link` já está importado no topo do ficheiro (`import Link from 'next/link'`, linha 2) — nenhum import novo.

- [ ] **Step 5: Type-check e commit**

```bash
npx tsc --noEmit
git add "app/api/users/me/calendar-token/route.ts" components/profile/CalendarFeedCard.tsx "app/(app)/profile/page.tsx" components/layout/Sidebar.tsx
git commit -m "feat: página de perfil com o link pessoal do feed ICS"
```

---

### Task 5: Toggles "Adicionar ao calendário" no contacto e no lead

**Files:**
- Modify: `app/api/people/[id]/route.ts`
- Modify: `components/contacts/ContactDetailPanel.tsx`
- Modify: `app/(app)/leads/[id]/page.tsx`

- [ ] **Step 1: Allowlist do PATCH de pessoas** — em `app/api/people/[id]/route.ts`, dentro do array `allowed` do `PATCH`:

```ts
  const allowed = [
    'name', 'email', 'phone', 'address', 'notes', 'types', 'financial_capacity', 'source', 'details',
    'assigned_to', 'is_regular', 'birthday', 'regular_interval_days',
    'is_special', 'special_notify_christmas', 'special_notify_easter', 'special_notify_birthday', 'special_dates',
```

Acrescentar `'calendar_sync_enabled'` à lista (por exemplo a seguir a `'regular_interval_days'`):

```ts
    'assigned_to', 'is_regular', 'birthday', 'regular_interval_days', 'calendar_sync_enabled',
```

`PATCH /api/leads/[id]` não precisa de alteração — faz passthrough direto do body (`update(leadData)`, sem allowlist), confirmado em "Factos do código".

- [ ] **Step 2: Toggle no contacto** — em `components/contacts/ContactDetailPanel.tsx`, acrescentar a função de toggle a seguir a `toggleSpecial` (depois da linha 171):

```ts
  async function toggleCalendarSync() {
    if (!person) return
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendar_sync_enabled: !person.calendar_sync_enabled }),
    })
    fetchPerson()
    onChanged?.()
  }
```

E no JSX, dentro do bloco `{cardTitle('Acompanhamento')}` (a seguir ao `</div>` que fecha a secção "Contacto especial", linha 586, e antes do `</div>` que fecha o container flex da secção, linha 587), acrescentar uma terceira secção:

```tsx
                {/* Sincronização com o calendário (interno + feed ICS pessoal) */}
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>Calendário</div>
                  <button onClick={toggleCalendarSync} className={`chip${person.calendar_sync_enabled ? ' active' : ''}`} style={{ width: '100%', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 10 }}>
                    <span style={{ fontSize: 'var(--fs-sm)' }}>{person.calendar_sync_enabled ? '✓ No calendário' : 'Adicionar notificações ao calendário'}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.75, fontWeight: 500 }}>{person.calendar_sync_enabled ? 'sincronizado' : 'não sincronizado'}</span>
                  </button>
                </div>
```

- [ ] **Step 3: Toggle no lead** — em `app/(app)/leads/[id]/page.tsx`, acrescentar a função a seguir a `setRegularInterval` (depois da linha 160):

```ts
  async function toggleCalendarSync() {
    if (!lead) return
    const next = !lead.calendar_sync_enabled
    setLead(prev => prev ? { ...prev, calendar_sync_enabled: next } : prev)
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calendar_sync_enabled: next }) })
  }
```

E no JSX, imediatamente a seguir ao bloco condicional "Frequência de follow-up própria" (depois do `)}` que fecha esse bloco, linha 381, antes de `{/* AI Suggestion Card */}`), acrescentar um cartão **sempre visível** (não condicionado a `lead.is_regular` nem a `!lead.people` — ao contrário do cartão de frequência, ver "Factos do código"):

```tsx
        {/* Sincronização com o calendário — independente da cadência normal
            (avisos de etapa disparam mesmo sem is_regular) */}
        <div className="card" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Notificações deste lead no calendário (interno + feed pessoal)</div>
          <button type="button" onClick={toggleCalendarSync} className={`chip${lead.calendar_sync_enabled ? ' active' : ''}`}>
            {lead.calendar_sync_enabled ? '✓ No calendário' : 'Adicionar ao calendário'}
          </button>
        </div>
```

- [ ] **Step 4: Type-check e commit**

```bash
npx tsc --noEmit
git add "app/api/people/[id]/route.ts" components/contacts/ContactDetailPanel.tsx "app/(app)/leads/[id]/page.tsx"
git commit -m "feat: toggle de sincronização com o calendário no contacto e no lead"
```

---

### Task 6: Indicação visual em `/activities`

**Files:**
- Modify: `app/(app)/activities/page.tsx`

- [ ] **Step 1: Badge de sino nas atividades espelhadas**

No pill do dia (mês), linha 445-446, o conteúdo do evento é:

```tsx
                            {ACTIVITY_ICONS[a.type]} {a.title}
```

Substituir por:

```tsx
                            {ACTIVITY_ICONS[a.type]} {a.title}{a.source === 'notification' && ' 🔔'}
```

Na sidebar de pendentes, linha 487-491:

```tsx
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: `${ACTIVITY_COLORS[a.type]}22`, color: ACTIVITY_COLORS[a.type], fontWeight: 500 }}>
                        {ACTIVITY_LABELS[a.type]}
                      </span>
```

Substituir por:

```tsx
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.source === 'notification' && '🔔 '}{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: `${ACTIVITY_COLORS[a.type]}22`, color: ACTIVITY_COLORS[a.type], fontWeight: 500 }}>
                        {ACTIVITY_LABELS[a.type]}
                      </span>
```

No cabeçalho do painel de detalhe (`selectedActivity`), linha 276-279:

```tsx
                <span style={{ fontSize: 20 }}>{ACTIVITY_ICONS[selectedActivity.type]}</span>
```

Substituir por:

```tsx
                <span style={{ fontSize: 20 }}>{ACTIVITY_ICONS[selectedActivity.type]}</span>
                {selectedActivity.source === 'notification' && <span title="Criada automaticamente a partir de uma notificação" style={{ fontSize: 14 }}>🔔</span>}
```

(Nenhuma alteração é necessária em `app/api/activities/route.ts` nem em `app/api/activities/[id]/route.ts` — ambos já selecionam `'*, ...'`, por isso `source`/`notification_id` chegam automaticamente ao cliente assim que o tipo `Activity` for atualizado, feito na Task 1.)

- [ ] **Step 2: Type-check e commit**

```bash
npx tsc --noEmit
git add "app/(app)/activities/page.tsx"
git commit -m "feat: indicação visual das atividades espelhadas a partir de notificações"
```

---

### Task 7: Migração + build + verificação manual final (coordenador)

- [ ] **Step 1: Aplicar a migração** via MCP Supabase (`apply_migration`, nome `calendar_sync`, SQL do ficheiro da Task 1). Confirmar com `execute_sql`:

```sql
select column_name from information_schema.columns
where table_name in ('people','leads','users','activities')
  and column_name in ('calendar_sync_enabled','calendar_token','source','notification_id')
order by table_name, column_name;
```

Esperado: 5 linhas (`activities.notification_id`, `activities.source`, `leads.calendar_sync_enabled`, `people.calendar_sync_enabled`, `users.calendar_token`).

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Preview manual — toggles e ligação com o cron** (mapeia diretamente os pontos "Testes" da spec)

1. Abrir a ficha de um contacto marcado como regular (`is_regular = true`), ligar "Adicionar notificações ao calendário". Confirmar via `execute_sql` que `people.calendar_sync_enabled = true` para esse registo.
2. Correr manualmente o cron de acompanhamento (com o `CRON_SECRET` do `.env.local`):

```bash
curl -s -X POST http://localhost:3000/api/cron/contact-followup \
  -H "Authorization: Bearer $CRON_SECRET"
```

3. Verificar via `execute_sql`: `select * from activities where person_id = '<id-do-contacto>' and source = 'notification';` — deve existir 1 linha nova, `type = 'tarefa'`, `notification_id` preenchido.
4. Confirmar um contacto **sem** o toggle ligado (`calendar_sync_enabled = false`) que também seria elegível para follow-up — não deve ter nenhuma `activity` com `source = 'notification'`.
5. Repetir o `curl` do passo 2 (reexecutar o cron) e confirmar que **não** aparece uma segunda `activity` para a mesma `notification_id` (a query do passo 3 continua a devolver 1 linha).
6. Abrir `/activities` e confirmar que a atividade espelhada mostra o 🔔 (painel de detalhe, pill do mês e sidebar de pendentes).
7. Repetir os passos 1-3 para um **lead** com um aviso de etapa configurado em Definições → Pipeline → 🔔 (`StageNotificationsModal`), correndo `curl -X POST http://localhost:3000/api/cron/stage-notifications -H "Authorization: Bearer $CRON_SECRET"` em vez do cron de contactos.
8. Limpar: apagar as `activities` de teste criadas nos passos acima e desligar os toggles usados.

- [ ] **Step 4: Preview manual — feed ICS**

1. Em `/profile`, copiar o link do feed (deve ter a forma `http://localhost:3000/api/calendar/<uuid>.ics`).
2. `curl -s http://localhost:3000/api/calendar/<uuid>.ics` — confirmar `Content-Type: text/calendar; charset=utf-8` nos headers (`curl -sI ...`) e que o corpo é um `VCALENDAR` com um `VEVENT` por cada `activity` de `source = 'notification'` atribuída a este utilizador (contar `grep -c BEGIN:VEVENT`).
3. `curl -s http://localhost:3000/api/calendar/token-invalido.ics` — confirmar `404` (`curl -sI ... | head -1`).
4. Em `/profile`, clicar "Regenerar link", confirmar (no prompt) e verificar que a URL muda. Repetir o `curl` do passo 2 com o **link antigo** — deve devolver `404`. Repetir com o **link novo** — deve devolver o feed normalmente.
5. (Opcional, se houver acesso a um cliente de calendário) colar o link novo no Notion Calendar / Google Calendar ("Subscrever calendário" / "From URL") e confirmar que os eventos aparecem com o título e a data corretos.

- [ ] **Step 5: Consola sem erros novos** — verificar `npx eslint` limpo e a consola do browser sem erros durante os passos 3-4.

- [ ] **Step 6: Revisão final da fatia + commit de eventuais correções.**
