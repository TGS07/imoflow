# Automações/Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar um sistema de automações com regras pré-definidas que executam ações (criar atividade, enviar notificação, mover stage) em resposta a eventos no CRM (lead criado, stage mudou, atividade concluída, lead inativo).

**Architecture:** Tabelas `automation_rules` e `automation_logs` na BD para persistir regras e histórico. Engine em `lib/automations/engine.ts` que avalia e executa as regras. Os endpoints existentes de leads e atividades chamam o engine após cada evento relevante. Um route handler `/api/cron/lead-inactive` serve de cron job para verificar inatividade.

**Tech Stack:** Next.js 15, Supabase (Postgres + RLS), TypeScript, `lib/supabase/server.ts` pattern existente.

---

## Estrutura de Ficheiros

| Ficheiro | Ação | Responsabilidade |
|---------|------|-----------------|
| `supabase/migrations/20260531_automations.sql` | Criar | Tabelas `automation_rules` e `automation_logs` + RLS + seed data |
| `types/automation.ts` | Criar | Tipos TypeScript: `AutomationRule`, `AutomationLog`, `AutomationEvent` |
| `types/index.ts` | Modificar | Re-exportar novos tipos |
| `lib/notifications.ts` | Modificar | Adicionar tipo `automation_rule_triggered` a `NotificationType` |
| `lib/automations/engine.ts` | Criar | Engine principal: `triggerAutomations()` + handlers |
| `app/api/leads/route.ts` | Modificar | Disparar `lead_created` após criar lead |
| `app/api/leads/[id]/route.ts` | Modificar | Disparar `stage_changed` quando stage muda |
| `app/api/activities/[id]/route.ts` | Modificar | Disparar `activity_completed` quando `completed` muda para `true` |
| `app/api/cron/lead-inactive/route.ts` | Criar | Route handler para cron job de inatividade |
| `app/api/automations/route.ts` | Criar | GET lista de regras, PATCH toggle is_active |
| `app/api/automations/[id]/logs/route.ts` | Criar | GET últimos 20 logs de uma regra |
| `app/(app)/settings/automations/page.tsx` | Criar | UI de gestão: lista regras + toggle + logs |
| `components/layout/Sidebar.tsx` | Modificar | Adicionar link "Automações" em Definições |

---

## Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20260531_automations.sql`

- [ ] **Step 1: Criar o ficheiro de migração**

```sql
-- automation_rules
CREATE TABLE public.automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  trigger_type  TEXT NOT NULL CHECK (trigger_type IN (
                  'stage_changed', 'lead_created', 'activity_completed', 'lead_inactive'
                )),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type   TEXT NOT NULL CHECK (action_type IN (
                  'create_activity', 'send_notification', 'move_stage'
                )),
  action_config  JSONB NOT NULL DEFAULT '{}',
  pipeline_id   UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX automation_rules_trigger_idx ON automation_rules(trigger_type, is_active);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_read" ON automation_rules
  FOR SELECT USING (true);
CREATE POLICY "automation_rules_write" ON automation_rules
  FOR ALL USING (true) WITH CHECK (true);

-- automation_logs
CREATE TABLE public.automation_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  result        JSONB
);

CREATE INDEX automation_logs_rule_idx ON automation_logs(rule_id, triggered_at DESC);
CREATE INDEX automation_logs_lead_idx ON automation_logs(lead_id, triggered_at DESC);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_logs_read" ON automation_logs
  FOR SELECT USING (true);
CREATE POLICY "automation_logs_write" ON automation_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Seed data: regras pré-definidas
-- Nota: trigger_config usa "to_stage_name" para regras de stage, o engine resolve o ID em runtime
INSERT INTO automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active) VALUES
  (
    'Primeiro Contacto',
    'Quando uma nova lead é criada, agenda chamada de primeiro contacto',
    'lead_created',
    '{}',
    'create_activity',
    '{"activity_type": "chamada", "title": "Primeiro contacto", "due_days": 1}'
  ),
  (
    'Preparar Proposta',
    'Quando lead avança para stage "Proposta", agenda envio de proposta por email',
    'stage_changed',
    '{"to_stage_name": "Proposta"}',
    'create_activity',
    '{"activity_type": "email", "title": "Enviar proposta", "due_days": 2}'
  ),
  (
    'Agendar Visita',
    'Quando lead avança para stage "Visita", agenda visita ao imóvel',
    'stage_changed',
    '{"to_stage_name": "Visita"}',
    'create_activity',
    '{"activity_type": "visita", "title": "Agendar visita ao imóvel", "due_days": 3}'
  ),
  (
    'Follow-up Pós-Atividade',
    'Quando uma atividade é concluída, agenda chamada de follow-up',
    'activity_completed',
    '{}',
    'create_activity',
    '{"activity_type": "chamada", "title": "Follow-up", "due_days": 2}'
  ),
  (
    'Alerta de Inatividade (7 dias)',
    'Envia notificação quando lead está sem atividade há 7 dias',
    'lead_inactive',
    '{"inactive_days": 7}',
    'send_notification',
    '{"message": "Lead inativa há 7 dias sem atividade registada"}'
  ),
  (
    'Mover para Frio (14 dias)',
    'Move lead para stage Frio quando está sem atividade há 14 dias',
    'lead_inactive',
    '{"inactive_days": 14}',
    'move_stage',
    '{"to_stage_name": "Frio"}'
  );
```

- [ ] **Step 2: Aplicar a migração**

```bash
npx supabase db push
```

Esperado: sem erros. Verificar com:

```bash
npx supabase db diff
```

Esperado: diff vazio (migração aplicada).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260531_automations.sql
git commit -m "feat: add automation_rules and automation_logs tables with seed data"
```

---

## Task 2: Tipos TypeScript

**Files:**
- Create: `types/automation.ts`
- Modify: `types/index.ts`

- [ ] **Step 1: Criar `types/automation.ts`**

```typescript
export type AutomationTriggerType =
  | 'stage_changed'
  | 'lead_created'
  | 'activity_completed'
  | 'lead_inactive'

export type AutomationActionType =
  | 'create_activity'
  | 'send_notification'
  | 'move_stage'

export type AutomationRule = {
  id: string
  name: string
  description: string | null
  trigger_type: AutomationTriggerType
  trigger_config: Record<string, unknown>
  action_type: AutomationActionType
  action_config: Record<string, unknown>
  pipeline_id: string | null
  is_active: boolean
  created_at: string
}

export type AutomationLog = {
  id: string
  rule_id: string
  lead_id: string
  triggered_at: string
  status: 'success' | 'failed'
  result: Record<string, unknown> | null
  // joins opcionais
  automation_rules?: { name: string }
  leads?: { id: string; name: string }
}

export type AutomationEvent = {
  type: AutomationTriggerType
  leadId: string
  userId: string
  agencyId: string
  meta?: {
    toStageId?: string
    toStageName?: string
    pipelineId?: string
    activityId?: string
  }
}
```

- [ ] **Step 2: Adicionar re-export em `types/index.ts`**

Adicionar no final do ficheiro:

```typescript
export type { AutomationTriggerType, AutomationActionType, AutomationRule, AutomationLog, AutomationEvent } from './automation'
```

- [ ] **Step 3: Commit**

```bash
git add types/automation.ts types/index.ts
git commit -m "feat: add automation TypeScript types"
```

---

## Task 3: Actualizar NotificationType

**Files:**
- Modify: `lib/notifications.ts`

- [ ] **Step 1: Adicionar novo tipo de notificação**

No ficheiro `lib/notifications.ts`, localizar:

```typescript
export type NotificationType =
  | 'new_lead'
  | 'task_due'
  | 'lead_stage_changed'
  | 'email_received'
```

Substituir por:

```typescript
export type NotificationType =
  | 'new_lead'
  | 'task_due'
  | 'lead_stage_changed'
  | 'email_received'
  | 'automation_rule_triggered'
```

- [ ] **Step 2: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: add automation_rule_triggered notification type"
```

---

## Task 4: Engine de Automações

**Files:**
- Create: `lib/automations/engine.ts`

- [ ] **Step 1: Criar `lib/automations/engine.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { AutomationEvent, AutomationRule } from '@/types'
import { ActivityType } from '@/types/activity'

export async function triggerAutomations(event: AutomationEvent): Promise<void> {
  const supabase = await createClient()

  // 1. Buscar regras activas para este trigger
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('trigger_type', event.type)
    .eq('is_active', true)

  if (error || !rules || rules.length === 0) return

  // 2. Filtrar por pipeline se necessário
  const matchingRules = rules.filter((rule: AutomationRule) => {
    if (rule.pipeline_id && rule.pipeline_id !== event.meta?.pipelineId) return false
    return matchesTriggerConfig(rule, event)
  })

  if (matchingRules.length === 0) return

  // 3. Buscar dados do lead
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, assigned_to, agency_id, stage_id')
    .eq('id', event.leadId)
    .single()

  if (!lead) return

  const assignedTo = lead.assigned_to ?? event.userId
  const agencyId = lead.agency_id ?? event.agencyId

  // 4. Executar cada regra
  for (const rule of matchingRules) {
    // Deduplicação: não executar a mesma regra para o mesmo lead mais de uma vez por hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentLog } = await supabase
      .from('automation_logs')
      .select('id')
      .eq('rule_id', rule.id)
      .eq('lead_id', event.leadId)
      .gte('triggered_at', oneHourAgo)
      .limit(1)
      .single()

    if (recentLog) continue

    let status: 'success' | 'failed' = 'success'
    let result: Record<string, unknown> = {}

    try {
      result = await executeAction(rule, event.leadId, assignedTo, agencyId, supabase)
    } catch (err) {
      status = 'failed'
      result = { error: err instanceof Error ? err.message : String(err) }
    }

    // 5. Registar log
    await supabase.from('automation_logs').insert({
      rule_id: rule.id,
      lead_id: event.leadId,
      status,
      result,
    })
  }
}

function matchesTriggerConfig(rule: AutomationRule, event: AutomationEvent): boolean {
  const config = rule.trigger_config as Record<string, unknown>

  if (rule.trigger_type === 'stage_changed') {
    if (config.to_stage_id && config.to_stage_id !== event.meta?.toStageId) return false
    if (config.to_stage_name && config.to_stage_name !== event.meta?.toStageName) return false
  }

  if (rule.trigger_type === 'lead_inactive') {
    // Verificado pelo cron job antes de chamar triggerAutomations
    // O event.meta.inactive_days indica quantos dias de inatividade
    const required = Number(config.inactive_days ?? 0)
    const actual = Number(event.meta?.inactive_days ?? 0)
    if (actual < required) return false
    // Só executa exactamente no threshold (não acumula todos os dias seguintes)
    if (actual !== required) return false
  }

  return true
}

async function executeAction(
  rule: AutomationRule,
  leadId: string,
  assignedTo: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<string, unknown>> {
  const config = rule.action_config as Record<string, unknown>

  if (rule.action_type === 'create_activity') {
    const dueDays = Number(config.due_days ?? 1)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDays)

    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        agency_id: agencyId,
        lead_id: leadId,
        assigned_to: assignedTo,
        type: (config.activity_type as ActivityType) ?? 'tarefa',
        title: String(config.title ?? 'Atividade automática'),
        due_date: dueDate.toISOString(),
        completed: false,
      })
      .select('id, title')
      .single()

    if (error) throw new Error(error.message)
    return { created_activity_id: activity.id, title: activity.title }
  }

  if (rule.action_type === 'send_notification') {
    await createNotification({
      userId: assignedTo,
      agencyId,
      type: 'automation_rule_triggered',
      title: rule.name,
      body: String(config.message ?? rule.name),
      link: `/leads/${leadId}`,
    })
    return { notification_sent: true }
  }

  if (rule.action_type === 'move_stage') {
    // Resolver stage por ID ou nome
    let targetStageId = config.to_stage_id as string | undefined

    if (!targetStageId && config.to_stage_name) {
      const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .ilike('name', String(config.to_stage_name))
        .limit(1)
        .single()

      targetStageId = stage?.id
    }

    if (!targetStageId) {
      throw new Error(`Stage "${config.to_stage_name ?? config.to_stage_id}" não encontrado`)
    }

    // moveStageHandler: NÃO dispara triggerAutomations para evitar loops
    const { error } = await supabase
      .from('leads')
      .update({ stage_id: targetStageId })
      .eq('id', leadId)

    if (error) throw new Error(error.message)
    return { moved_to_stage_id: targetStageId }
  }

  throw new Error(`Action type desconhecido: ${rule.action_type}`)
}
```

- [ ] **Step 2: Verificar que o TypeScript compila**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/automations/engine.ts
git commit -m "feat: add automation engine with create_activity, send_notification, move_stage handlers"
```

---

## Task 5: Integrar engine nos endpoints de leads

**Files:**
- Modify: `app/api/leads/route.ts`
- Modify: `app/api/leads/[id]/route.ts`

### 5a — POST /api/leads (lead_created)

- [ ] **Step 1: Adicionar import do engine em `app/api/leads/route.ts`**

No topo do ficheiro, após os imports existentes, adicionar:

```typescript
import { triggerAutomations } from '@/lib/automations/engine'
```

- [ ] **Step 2: Disparar evento após criar lead**

Localizar no POST handler, a linha:

```typescript
  return NextResponse.json(data, { status: 201 })
```

Substituir por:

```typescript
  // Disparar automações de lead_created (sem await para não bloquear resposta)
  triggerAutomations({
    type: 'lead_created',
    leadId: data.id,
    userId: user.id,
    agencyId: profile.agency_id,
    meta: { pipelineId: data.pipeline_id ?? undefined },
  }).catch(console.error)

  return NextResponse.json(data, { status: 201 })
```

### 5b — PATCH /api/leads/[id] (stage_changed)

- [ ] **Step 3: Adicionar import do engine em `app/api/leads/[id]/route.ts`**

No topo do ficheiro, após os imports existentes, adicionar:

```typescript
import { triggerAutomations } from '@/lib/automations/engine'
```

- [ ] **Step 4: Disparar evento após mudança de stage**

Localizar o bloco existente de notificação de stage:

```typescript
  if (before && leadData.stage_id && leadData.stage_id !== before.stage_id && before.assigned_to && before.agency_id) {
    const newStageName = data.pipeline_stages?.name ?? 'desconhecida'
    const oldStageName = (before.pipeline_stages as unknown as { name: string } | null)?.name ?? 'desconhecida'
    await createNotification({
      userId: before.assigned_to,
      agencyId: before.agency_id,
      type: 'lead_stage_changed',
      title: `Lead ${before.name} movida para ${newStageName}`,
      body: `A lead ${before.name} foi movida de "${oldStageName}" para "${newStageName}".`,
      link: `/leads/${id}`,
    })
  }
```

Substituir por:

```typescript
  if (before && leadData.stage_id && leadData.stage_id !== before.stage_id && before.assigned_to && before.agency_id) {
    const newStageName = data.pipeline_stages?.name ?? 'desconhecida'
    const oldStageName = (before.pipeline_stages as unknown as { name: string } | null)?.name ?? 'desconhecida'
    await createNotification({
      userId: before.assigned_to,
      agencyId: before.agency_id,
      type: 'lead_stage_changed',
      title: `Lead ${before.name} movida para ${newStageName}`,
      body: `A lead ${before.name} foi movida de "${oldStageName}" para "${newStageName}".`,
      link: `/leads/${id}`,
    })

    // Disparar automações de stage_changed
    triggerAutomations({
      type: 'stage_changed',
      leadId: id,
      userId: user.id,
      agencyId: before.agency_id,
      meta: {
        toStageId: leadData.stage_id,
        toStageName: newStageName,
        pipelineId: data.pipeline_id ?? undefined,
      },
    }).catch(console.error)
  }
```

- [ ] **Step 5: Verificar que o TypeScript compila**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add app/api/leads/route.ts app/api/leads/\[id\]/route.ts
git commit -m "feat: trigger automations on lead_created and stage_changed events"
```

---

## Task 6: Integrar engine no endpoint de atividades

**Files:**
- Modify: `app/api/activities/[id]/route.ts`

- [ ] **Step 1: Adicionar import do engine**

No topo do ficheiro, adicionar:

```typescript
import { triggerAutomations } from '@/lib/automations/engine'
```

- [ ] **Step 2: Buscar dados antes do update para detectar mudança de estado**

Localizar no PATCH handler, antes do update:

```typescript
  const body = await request.json()

  if (body.completed === true && !body.completed_at) {
    body.completed_at = new Date().toISOString()
  }
  if (body.completed === false) {
    body.completed_at = null
  }
```

Substituir por:

```typescript
  const body = await request.json()
  const wasCompleted = body.completed === true

  // Guardar estado anterior para detectar mudança para completed
  const { data: before } = await supabase
    .from('activities')
    .select('completed, lead_id, assigned_to')
    .eq('id', id)
    .single()

  if (body.completed === true && !body.completed_at) {
    body.completed_at = new Date().toISOString()
  }
  if (body.completed === false) {
    body.completed_at = null
  }
```

- [ ] **Step 3: Disparar evento após completar atividade**

Localizar:

```typescript
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
```

Substituir por:

```typescript
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Disparar automações quando atividade é marcada como concluída e estava incompleta
  if (wasCompleted && before && !before.completed && before.lead_id) {
    // Buscar agencyId do lead
    const { data: lead } = await supabase
      .from('leads')
      .select('agency_id')
      .eq('id', before.lead_id)
      .single()

    if (lead?.agency_id) {
      triggerAutomations({
        type: 'activity_completed',
        leadId: before.lead_id,
        userId: user.id,
        agencyId: lead.agency_id,
        meta: { activityId: id },
      }).catch(console.error)
    }
  }

  return NextResponse.json(data)
```

- [ ] **Step 4: Verificar que o TypeScript compila**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/api/activities/\[id\]/route.ts
git commit -m "feat: trigger automations on activity_completed event"
```

---

## Task 7: Cron Job para Leads Inativas

**Files:**
- Create: `app/api/cron/lead-inactive/route.ts`

- [ ] **Step 1: Criar o route handler**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { triggerAutomations } from '@/lib/automations/engine'

// Este endpoint é chamado diariamente (ex: via Vercel Cron, GitHub Actions, etc.)
// Proteger com secret header para evitar chamadas não autorizadas
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Buscar regras de inatividade activas para saber os thresholds
  const { data: inactivityRules } = await supabase
    .from('automation_rules')
    .select('trigger_config')
    .eq('trigger_type', 'lead_inactive')
    .eq('is_active', true)

  if (!inactivityRules || inactivityRules.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  // Thresholds únicos de dias (ex: [7, 14])
  const thresholds = [...new Set(
    inactivityRules
      .map(r => Number((r.trigger_config as Record<string, unknown>).inactive_days ?? 0))
      .filter(d => d > 0)
  )]

  let processed = 0

  for (const days of thresholds) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffIso = cutoff.toISOString()

    // Leads activas sem atividade há exactamente `days` dias
    // (última atividade entre cutoff-1d e cutoff)
    const dayBefore = new Date(cutoff)
    dayBefore.setDate(dayBefore.getDate() - 1)

    const { data: leads } = await supabase
      .from('leads')
      .select('id, assigned_to, agency_id')
      .is('won_at', null)
      .is('lost_at', null)

    if (!leads) continue

    for (const lead of leads) {
      if (!lead.assigned_to || !lead.agency_id) continue

      // Verificar última atividade desta lead
      const { data: lastActivity } = await supabase
        .from('activities')
        .select('due_date, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastActivityDate = lastActivity
        ? new Date(lastActivity.due_date ?? lastActivity.created_at)
        : null

      // Lead sem atividade OU última atividade foi há exactamente `days` dias (±12h)
      const twelveHours = 12 * 60 * 60 * 1000
      const isInactive = !lastActivityDate || (
        lastActivityDate.getTime() <= cutoff.getTime() + twelveHours &&
        lastActivityDate.getTime() >= dayBefore.getTime() - twelveHours
      )

      if (!isInactive) continue

      await triggerAutomations({
        type: 'lead_inactive',
        leadId: lead.id,
        userId: lead.assigned_to,
        agencyId: lead.agency_id,
        meta: { inactive_days: days },
      })

      processed++
    }
  }

  return NextResponse.json({ processed })
}
```

- [ ] **Step 2: Adicionar `CRON_SECRET` ao `.env.local` (se não existir)**

```bash
grep -q CRON_SECRET /Users/tomassampaio/Desktop/ImoFlow/.env.local || echo "\nCRON_SECRET=secret_local_dev" >> /Users/tomassampaio/Desktop/ImoFlow/.env.local
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/lead-inactive/route.ts
git commit -m "feat: add lead-inactive cron job endpoint"
```

---

## Task 8: API Routes para UI de Automações

**Files:**
- Create: `app/api/automations/route.ts`
- Create: `app/api/automations/[id]/logs/route.ts`

### 8a — GET/PATCH /api/automations

- [ ] **Step 1: Criar `app/api/automations/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### 8b — PATCH /api/automations/[id] para toggle

- [ ] **Step 2: Criar `app/api/automations/[id]/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { is_active } = body

  const { data, error } = await supabase
    .from('automation_rules')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### 8c — GET /api/automations/[id]/logs

- [ ] **Step 3: Criar `app/api/automations/[id]/logs/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('automation_logs')
    .select('*, leads(id, name)')
    .eq('rule_id', id)
    .order('triggered_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/api/automations/route.ts app/api/automations/\[id\]/route.ts app/api/automations/\[id\]/logs/route.ts
git commit -m "feat: add automation rules API endpoints (list, toggle, logs)"
```

---

## Task 9: UI de Gestão de Automações

**Files:**
- Create: `app/(app)/settings/automations/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

### 9a — Página de automações

- [ ] **Step 1: Criar `app/(app)/settings/automations/page.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { AutomationRule, AutomationLog } from '@/types'

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: 'Lead criada',
  stage_changed: 'Stage mudou',
  activity_completed: 'Atividade concluída',
  lead_inactive: 'Lead inativa',
}

const ACTION_LABELS: Record<string, string> = {
  create_activity: 'Criar atividade',
  send_notification: 'Enviar notificação',
  move_stage: 'Mover stage',
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, AutomationLog[]>>({})
  const [toggling, setToggling] = useState<string | null>(null)

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }
  const badgeStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background: active ? '#10B98120' : '#6B728020',
    color: active ? '#10B981' : '#6B7280',
  })

  useEffect(() => {
    fetch('/api/automations').then(r => r.json()).then(setRules)
  }, [])

  async function toggleRule(rule: AutomationRule) {
    setToggling(rule.id)
    const res = await fetch(`/api/automations/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r))
    }
    setToggling(null)
  }

  async function expandRule(ruleId: string) {
    if (expandedId === ruleId) {
      setExpandedId(null)
      return
    }
    setExpandedId(ruleId)
    if (!logs[ruleId]) {
      const res = await fetch(`/api/automations/${ruleId}/logs`)
      if (res.ok) {
        const data = await res.json()
        setLogs(prev => ({ ...prev, [ruleId]: data }))
      }
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Automações</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
        Regras que executam ações automaticamente em resposta a eventos no CRM.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rules.map(rule => (
          <div key={rule.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{rule.name}</span>
                  <span style={badgeStyle(rule.is_active)}>{rule.is_active ? 'Activa' : 'Inactiva'}</span>
                </div>
                {rule.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{rule.description}</p>
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Trigger: <strong>{TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Ação: <strong>{ACTION_LABELS[rule.action_type] ?? rule.action_type}</strong>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => expandRule(rule.id)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {expandedId === rule.id ? 'Fechar' : 'Logs'}
                </button>
                <button
                  onClick={() => toggleRule(rule)}
                  disabled={toggling === rule.id}
                  style={{
                    background: rule.is_active ? '#EF444420' : '#10B98120',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: rule.is_active ? '#EF4444' : '#10B981',
                    cursor: 'pointer',
                    opacity: toggling === rule.id ? 0.6 : 1,
                  }}
                >
                  {rule.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>

            {/* Logs expandidos */}
            {expandedId === rule.id && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Últimas execuções
                </p>
                {!logs[rule.id] ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>A carregar...</p>
                ) : logs[rule.id].length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma execução registada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {logs[rule.id].map(log => (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                        <span style={{ color: log.status === 'success' ? '#10B981' : '#EF4444', fontWeight: 600, minWidth: 14 }}>
                          {log.status === 'success' ? '✓' : '✗'}
                        </span>
                        <span style={{ color: 'var(--text)' }}>
                          {(log as AutomationLog & { leads?: { name: string } }).leads?.name ?? log.lead_id}
                        </span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {new Date(log.triggered_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 9b — Adicionar link na sidebar

- [ ] **Step 2: Adicionar "Automações" na sidebar**

Em `components/layout/Sidebar.tsx`, localizar:

```typescript
  { href: '/settings/pipeline', icon: '⚙', label: 'Configurações', section: 'Sistema' },
```

Substituir por:

```typescript
  { href: '/settings/pipeline', icon: '⚙', label: 'Configurações', section: 'Sistema' },
  { href: '/settings/automations', icon: '⚡', label: 'Automações', section: 'Sistema' },
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/settings/automations/page.tsx components/layout/Sidebar.tsx
git commit -m "feat: add automations settings page with rules list, toggle, and execution logs"
```

---

## Task 10: Teste Manual End-to-End

- [ ] **Step 1: Iniciar o servidor de desenvolvimento**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npm run dev
```

- [ ] **Step 2: Verificar página de Automações**

Navegar para `http://localhost:3000/settings/automations`.
Esperado: lista com 6 regras pré-definidas, todas activas.

- [ ] **Step 3: Testar toggle de regra**

Clicar em "Desactivar" numa regra.
Esperado: badge muda para "Inactiva", botão muda para "Activar".

- [ ] **Step 4: Testar lead_created**

Criar uma nova lead.
Esperado: após criar, deve aparecer uma atividade "Primeiro contacto" associada à lead (verificar na página da lead).

- [ ] **Step 5: Testar stage_changed**

Mover uma lead para o stage "Proposta" (se existir) ou qualquer stage.
Esperado: atividade criada automaticamente (se stage "Proposta" existe).

- [ ] **Step 6: Testar activity_completed**

Marcar uma atividade como concluída.
Esperado: nova atividade "Follow-up" criada para a mesma lead.

- [ ] **Step 7: Verificar logs**

Voltar a `/settings/automations`, clicar em "Logs" numa regra que foi disparada.
Esperado: lista de execuções com ✓ e nome da lead.

- [ ] **Step 8: Commit final**

```bash
git add -A && git commit -m "feat: complete automations/workflows subsystem (#5)"
```
