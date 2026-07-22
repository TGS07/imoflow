# Pipeline de Vendedores — correções e novas funcionalidades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o card da pipeline de vendedores (mostrar imóvel como info principal), permitir adicionar imóveis (não só contactos) a qualquer pipeline com a mesma pessoa repetida em imóveis diferentes, adicionar dois novos tipos de aviso de etapa (X dias após entrar / recorrente a cada X dias), e enviar as notificações do sistema também por Telegram.

**Architecture:** Mudanças aditivas sobre o esquema `leads`/`automation_rules`/`pipelines` já existente — sem tabelas novas. O botão "+ Contactos" é substituído por "+ Imóveis" em todas as pipelines; o motor de automação (`lib/automations/engine.ts`) ganha dois `trigger_type` novos avaliados por um cron diário novo; e `lib/notifications.ts` ganha um canal de envio adicional (Telegram, só envio) ao lado do email já existente.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Supabase (Postgres + RLS), Vercel Cron.

**Nota sobre testes:** este repositório não tem nenhum test runner configurado (`package.json` não tem `vitest`/`jest`/`playwright`, `find` não encontrou ficheiros `*.test.*`/`*.spec.*`). Introduzir um framework de testes do zero está fora do âmbito deste plano (YAGNI). A verificação de cada tarefa usa `npx tsc --noEmit` (type-check, o mais próximo de um "teste" automático disponível aqui) e, nas tarefas finais de cada fase, uma verificação manual no browser via dev server.

**Nota sobre migrations:** esta worktree não tem stack local do Supabase (`node_modules/` não está instalado) e a pasta `supabase/migrations/` já está incompleta face à base de dados real (ex. `20260613230751_idealista_bot_schema` não tem ficheiro local — foi aplicada por outro projeto). As migrations deste plano devem ser aplicadas com a ferramenta MCP `mcp__815f2f4b-6ae5-4702-9098-ffa5c7ad7442__apply_migration` contra o projeto `sxenhpowxhexcggkepen`, e o `.sql` correspondente deve ser também guardado em `supabase/migrations/` para histórico.

**Antes de começar:** correr `npm install` na raiz do repo (necessário para `npx tsc` funcionar e para poder consultar `node_modules/next/dist/docs/` conforme pede `AGENTS.md`).

---

## Fase 1 — Notificações de etapa (data específica + recorrência)

### Task 1: Migration — novos trigger_type + `leads.stage_entered_at`

**Files:**
- Create: `supabase/migrations/20260721120000_stage_notification_triggers.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Novos trigger_type para avisos de etapa: X dias após entrar / recorrente a cada X dias
ALTER TABLE public.automation_rules DROP CONSTRAINT automation_rules_trigger_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_trigger_type_check
  CHECK (trigger_type IN (
    'stage_changed', 'lead_created', 'activity_completed', 'lead_inactive',
    'whatsapp_message_received', 'stage_days_after_entry', 'stage_recurring'
  ));

-- Necessário para calcular "dias na etapa atual" (não existia nenhum registo disto)
ALTER TABLE public.leads ADD COLUMN stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE public.leads SET stage_entered_at = created_at;
```

- [ ] **Step 2: Aplicar a migration ao projeto Supabase**

Usar a tool `mcp__815f2f4b-6ae5-4702-9098-ffa5c7ad7442__apply_migration` com `project_id: "sxenhpowxhexcggkepen"`, `name: "stage_notification_triggers"`, e o SQL do Step 1.

- [ ] **Step 3: Confirmar**

Usar `mcp__815f2f4b-6ae5-4702-9098-ffa5c7ad7442__execute_sql` com:
```sql
select column_name from information_schema.columns where table_name = 'leads' and column_name = 'stage_entered_at';
```
Esperado: devolve uma linha.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260721120000_stage_notification_triggers.sql
git commit -m "feat: add stage_days_after_entry/stage_recurring trigger types + leads.stage_entered_at"
```

---

### Task 2: Tipos — `AutomationTriggerType` e `AutomationEvent.meta`

**Files:**
- Modify: `types/automation.ts:1-6`, `types/automation.ts:40-53`

- [ ] **Step 1: Adicionar os novos trigger types**

Em `types/automation.ts`, substituir:

```ts
export type AutomationTriggerType =
  | 'stage_changed'
  | 'lead_created'
  | 'activity_completed'
  | 'lead_inactive'
  | 'whatsapp_message_received'
```

por:

```ts
export type AutomationTriggerType =
  | 'stage_changed'
  | 'lead_created'
  | 'activity_completed'
  | 'lead_inactive'
  | 'whatsapp_message_received'
  | 'stage_days_after_entry'
  | 'stage_recurring'
```

- [ ] **Step 2: Adicionar `daysSinceStageEntry` ao meta do evento**

Substituir:

```ts
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
    inactiveDays?: number
    messageBody?: string
  }
}
```

por:

```ts
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
    inactiveDays?: number
    messageBody?: string
    daysSinceStageEntry?: number
  }
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados com `types/automation.ts` (vai haver erros nos ficheiros que ainda não usam os campos novos — resolvidos nas próximas tasks).

- [ ] **Step 4: Commit**

```bash
git add types/automation.ts
git commit -m "feat: add stage_days_after_entry/stage_recurring types"
```

---

### Task 3: Motor de automação — avaliar os 2 novos triggers

**Files:**
- Modify: `lib/automations/engine.ts:44-49`, `lib/automations/engine.ts:100-118`

- [ ] **Step 1: Incluir os novos trigger_type no filtro por etapa**

Em `lib/automations/engine.ts`, substituir (linhas 44-49):

```ts
  const stageFilteredRules = matchingRules.filter((rule: AutomationRule) => {
    if (rule.trigger_type !== 'lead_inactive') return true
    const cfgStage = (rule.trigger_config as Record<string, unknown>).stage_id
    return !cfgStage || cfgStage === lead.stage_id
  })
```

por:

```ts
  const STAGE_SCOPED_TRIGGERS = ['lead_inactive', 'stage_days_after_entry', 'stage_recurring']
  const stageFilteredRules = matchingRules.filter((rule: AutomationRule) => {
    if (!STAGE_SCOPED_TRIGGERS.includes(rule.trigger_type)) return true
    const cfgStage = (rule.trigger_config as Record<string, unknown>).stage_id
    return !cfgStage || cfgStage === lead.stage_id
  })
```

- [ ] **Step 2: Adicionar a avaliação dos 2 novos triggers em `matchesTriggerConfig`**

Em `lib/automations/engine.ts`, dentro de `matchesTriggerConfig` (depois do bloco `if (rule.trigger_type === 'lead_inactive') { ... }`, antes do `return true` final), adicionar:

```ts
  if (rule.trigger_type === 'stage_days_after_entry') {
    const required = Number(config.days ?? 0)
    const actual = Number(event.meta?.daysSinceStageEntry ?? -1)
    if (required <= 0 || actual !== required) return false
  }

  if (rule.trigger_type === 'stage_recurring') {
    const required = Number(config.interval_days ?? 0)
    const actual = Number(event.meta?.daysSinceStageEntry ?? 0)
    if (required <= 0 || actual <= 0 || actual % required !== 0) return false
  }
```

`stage_days_after_entry` dispara exatamente no dia (`actual === required`); `stage_recurring` dispara em múltiplos exatos do intervalo (`actual % required === 0`). Como o cron (Task 5) corre uma vez por dia e `daysSinceStageEntry` incrementa 1 por dia, isto garante que cada regra dispara nos dias certos sem repetir nos outros — não é preciso nenhuma janela de deduplicação especial (fica no valor por omissão de 1 hora já usado pelas outras regras).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros em `lib/automations/engine.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/automations/engine.ts
git commit -m "feat: evaluate stage_days_after_entry/stage_recurring triggers"
```

---

### Task 4: Atualizar `stage_entered_at` quando a lead muda de etapa

**Files:**
- Modify: `app/api/leads/[id]/route.ts:61-66`

- [ ] **Step 1: Incluir `stage_entered_at` no update quando `stage_id` muda**

Em `app/api/leads/[id]/route.ts`, substituir:

```ts
  let updateQuery = supabase
    .from('leads')
    .update(leadData)
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
  if (profile.role === 'agent') updateQuery = updateQuery.eq('assigned_to', user.id)
```

por:

```ts
  const updateData = leadData.stage_id && leadData.stage_id !== before.stage_id
    ? { ...leadData, stage_entered_at: new Date().toISOString() }
    : leadData

  let updateQuery = supabase
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
  if (profile.role === 'agent') updateQuery = updateQuery.eq('assigned_to', user.id)
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add app/api/leads/[id]/route.ts
git commit -m "feat: track stage_entered_at on stage change"
```

**Addendum (revisão pós-review):** A abordagem acima foi substituída por um trigger de base de dados (`BEFORE UPDATE` em `public.leads`, migration `20260721230836_leads_stage_entered_at_trigger.sql`) que define `stage_entered_at = now()` sempre que `stage_id` muda, independentemente do caminho de escrita. A lógica manual em `app/api/leads/[id]/route.ts` foi revertida para a forma original, porque uma revisão de qualidade identificou que essa lógica só cobria o PATCH manual e deixava desatualizado o `stage_entered_at` em dois outros caminhos que também escrevem `stage_id` diretamente — a ação de automação `move_stage` (`lib/automations/engine.ts`) e a reatribuição de leads ao apagar uma etapa do pipeline (`app/api/pipeline-stages/[id]/route.ts`) — além de ter um risco de TOCTOU (comparação com uma linha `before` pré-lida, sem lock/transação). O trigger cobre todos os caminhos atomicamente e elimina o TOCTOU por operar sobre os valores OLD/NEW reais no momento da escrita.

---

### Task 5: Cron novo — `stage-notifications`

**Files:**
- Create: `app/api/cron/stage-notifications/route.ts`

- [ ] **Step 1: Escrever o endpoint**

```ts
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { triggerAutomations } from '@/lib/automations/engine'

// Cron diário (ver vercel.json): avalia os avisos de etapa "X dias após
// entrar" e "recorrente a cada X dias" para todas as leads ativas,
// comparando com leads.stage_entered_at.
export async function GET(request: Request) { return handleCron(request) }
export async function POST(request: Request) { return handleCron(request) }

async function handleCron(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: rules } = await supabase
    .from('automation_rules')
    .select('id')
    .in('trigger_type', ['stage_days_after_entry', 'stage_recurring'])
    .eq('is_active', true)

  if (!rules || rules.length === 0) return NextResponse.json({ processed: 0 })

  const { data: leads } = await supabase
    .from('leads')
    .select('id, assigned_to, agency_id, stage_entered_at, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)

  if (!leads || leads.length === 0) return NextResponse.json({ processed: 0 })

  const now = Date.now()
  let processed = 0

  for (const lead of leads) {
    if (!lead.assigned_to || !lead.agency_id) continue

    const enteredAt = new Date(lead.stage_entered_at).getTime()
    const daysSinceStageEntry = Math.floor((now - enteredAt) / (24 * 60 * 60 * 1000))
    if (daysSinceStageEntry <= 0) continue

    for (const type of ['stage_days_after_entry', 'stage_recurring'] as const) {
      await triggerAutomations({
        type,
        leadId: lead.id,
        userId: lead.assigned_to,
        agencyId: lead.agency_id,
        meta: { daysSinceStageEntry },
      }, supabase)
      processed++
    }
  }

  return NextResponse.json({ processed })
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/stage-notifications/route.ts
git commit -m "feat: add stage-notifications cron"
```

---

### Task 6: Agendar o cron novo e corrigir `lead-inactive` (não estava agendado)

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Adicionar os crons em falta**

Substituir o conteúdo de `vercel.json` por:

```json
{
  "crons": [
    {
      "path": "/api/cron/task-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/seller-inactive",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/contact-followup",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/lead-inactive",
      "schedule": "10 9 * * *"
    },
    {
      "path": "/api/cron/stage-notifications",
      "schedule": "15 9 * * *"
    }
  ]
}
```

`lead-inactive` existia como ficheiro mas nunca tinha sido agendado — bug pré-existente encontrado durante a investigação, corrigido aqui por estar diretamente relacionado (mesma família de crons de etapa).

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "fix: schedule lead-inactive and stage-notifications crons"
```

---

### Task 7: API de notificações de etapa — suportar os 2 novos tipos

**Files:**
- Modify: `app/api/pipeline-stages/[id]/notifications/route.ts` (ficheiro completo)

- [ ] **Step 1: Reescrever o ficheiro**

Substituir todo o conteúdo de `app/api/pipeline-stages/[id]/notifications/route.ts` por:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Avisos por etapa, guardados como regras normais de automação:
// - "ao entrar":        trigger stage_changed + trigger_config.to_stage_id
// - "parado Xd":         trigger lead_inactive + trigger_config.{stage_id, inactive_days}
// - "X dias na etapa":   trigger stage_days_after_entry + trigger_config.{stage_id, days}
// - "a cada X dias":     trigger stage_recurring + trigger_config.{stage_id, interval_days}
// Todas com action send_notification (responsável da lead). O editor por
// etapa é o dono destas regras: desligar um toggle APAGA a regra
// (automation_logs.rule_id tem on delete cascade).

type StageNotificationsState = {
  on_enter: boolean
  stale_days: number | null
  days_after_entry: number | null
  recurring_days: number | null
}

async function getStage(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  if (!profile) return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id, name, pipeline_id, agency_id')
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .single()
  if (!stage) return { error: NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 }) }
  return { stage, agencyId: profile.agency_id }
}

async function readState(supabase: Awaited<ReturnType<typeof createClient>>, agencyId: string, stageId: string) {
  const [{ data: enterRules }, { data: staleRules }, { data: daysAfterRules }, { data: recurringRules }] = await Promise.all([
    supabase.from('automation_rules').select('id, is_active')
      .eq('agency_id', agencyId)
      .eq('trigger_type', 'stage_changed')
      .eq('trigger_config->>to_stage_id', stageId),
    supabase.from('automation_rules').select('id, is_active, trigger_config')
      .eq('agency_id', agencyId)
      .eq('trigger_type', 'lead_inactive')
      .eq('trigger_config->>stage_id', stageId),
    supabase.from('automation_rules').select('id, is_active, trigger_config')
      .eq('agency_id', agencyId)
      .eq('trigger_type', 'stage_days_after_entry')
      .eq('trigger_config->>stage_id', stageId),
    supabase.from('automation_rules').select('id, is_active, trigger_config')
      .eq('agency_id', agencyId)
      .eq('trigger_type', 'stage_recurring')
      .eq('trigger_config->>stage_id', stageId),
  ])
  const enter = (enterRules ?? []).find(r => r.is_active)
  const stale = (staleRules ?? []).find(r => r.is_active)
  const daysAfter = (daysAfterRules ?? []).find(r => r.is_active)
  const recurring = (recurringRules ?? []).find(r => r.is_active)
  const staleDays = stale ? Number((stale.trigger_config as Record<string, unknown>).inactive_days ?? 0) || null : null
  const daysAfterEntry = daysAfter ? Number((daysAfter.trigger_config as Record<string, unknown>).days ?? 0) || null : null
  const recurringDays = recurring ? Number((recurring.trigger_config as Record<string, unknown>).interval_days ?? 0) || null : null
  return {
    state: {
      on_enter: !!enter,
      stale_days: staleDays,
      days_after_entry: daysAfterEntry,
      recurring_days: recurringDays,
    } satisfies StageNotificationsState,
    enterRuleIds: (enterRules ?? []).map(r => r.id),
    staleRuleIds: (staleRules ?? []).map(r => r.id),
    daysAfterRuleIds: (daysAfterRules ?? []).map(r => r.id),
    recurringRuleIds: (recurringRules ?? []).map(r => r.id),
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const res = await getStage(supabase, id)
  if ('error' in res) return res.error
  const { state } = await readState(supabase, res.agencyId, id)
  return NextResponse.json(state)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const res = await getStage(supabase, id)
  if ('error' in res) return res.error
  const { stage, agencyId } = res

  const body = await request.json().catch(() => ({}))
  const onEnter = body.on_enter === true
  const staleDays = Number.isInteger(body.stale_days) && body.stale_days >= 1 ? body.stale_days as number : null
  if (body.stale_days != null && staleDays == null) {
    return NextResponse.json({ error: 'stale_days tem de ser um inteiro ≥ 1' }, { status: 400 })
  }
  const daysAfterEntry = Number.isInteger(body.days_after_entry) && body.days_after_entry >= 1 ? body.days_after_entry as number : null
  if (body.days_after_entry != null && daysAfterEntry == null) {
    return NextResponse.json({ error: 'days_after_entry tem de ser um inteiro ≥ 1' }, { status: 400 })
  }
  const recurringDays = Number.isInteger(body.recurring_days) && body.recurring_days >= 1 ? body.recurring_days as number : null
  if (body.recurring_days != null && recurringDays == null) {
    return NextResponse.json({ error: 'recurring_days tem de ser um inteiro ≥ 1' }, { status: 400 })
  }

  const { enterRuleIds, staleRuleIds, daysAfterRuleIds, recurringRuleIds } = await readState(supabase, agencyId, id)

  // Sincronizar "ao entrar"
  if (onEnter) {
    const row = {
      name: `Etapa ${stage.name}: aviso de entrada`,
      trigger_config: { to_stage_id: id },
      action_config: { message: `Um contacto entrou na etapa "${stage.name}".` },
      is_active: true,
    }
    if (enterRuleIds.length === 0) {
      const { error } = await supabase.from('automation_rules').insert({
        agency_id: agencyId,
        description: 'Criado pelo editor de notificações da etapa',
        trigger_type: 'stage_changed',
        action_type: 'send_notification',
        pipeline_id: stage.pipeline_id,
        ...row,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('automation_rules').update(row).in('id', enterRuleIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (enterRuleIds.length > 0) {
    const { error } = await supabase.from('automation_rules').delete().in('id', enterRuleIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sincronizar "parado há X dias"
  if (staleDays != null) {
    const row = {
      name: `Etapa ${stage.name}: parado ${staleDays} dias`,
      trigger_config: { stage_id: id, inactive_days: staleDays },
      action_config: { message: `Um contacto está há ${staleDays} dias sem atividade na etapa "${stage.name}".` },
      is_active: true,
    }
    if (staleRuleIds.length === 0) {
      // Sem pipeline_id: o cron lead-inactive não envia meta.pipelineId, e o
      // gate por pipeline do motor descartaria a regra (nunca dispararia).
      // O filtro por stage_id já a limita à etapa — e a etapa implica a pipeline.
      const { error } = await supabase.from('automation_rules').insert({
        agency_id: agencyId,
        description: 'Criado pelo editor de notificações da etapa',
        trigger_type: 'lead_inactive',
        action_type: 'send_notification',
        ...row,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('automation_rules').update(row).in('id', staleRuleIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (staleRuleIds.length > 0) {
    const { error } = await supabase.from('automation_rules').delete().in('id', staleRuleIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sincronizar "X dias após entrar na etapa"
  if (daysAfterEntry != null) {
    const row = {
      name: `Etapa ${stage.name}: ${daysAfterEntry} dias após entrar`,
      trigger_config: { stage_id: id, days: daysAfterEntry },
      action_config: { message: `Um contacto está há ${daysAfterEntry} dias na etapa "${stage.name}".` },
      is_active: true,
    }
    if (daysAfterRuleIds.length === 0) {
      const { error } = await supabase.from('automation_rules').insert({
        agency_id: agencyId,
        description: 'Criado pelo editor de notificações da etapa',
        trigger_type: 'stage_days_after_entry',
        action_type: 'send_notification',
        ...row,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('automation_rules').update(row).in('id', daysAfterRuleIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (daysAfterRuleIds.length > 0) {
    const { error } = await supabase.from('automation_rules').delete().in('id', daysAfterRuleIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sincronizar "a cada X dias" (recorrente)
  if (recurringDays != null) {
    const row = {
      name: `Etapa ${stage.name}: lembrete a cada ${recurringDays} dias`,
      trigger_config: { stage_id: id, interval_days: recurringDays },
      action_config: { message: `Lembrete: um contacto continua na etapa "${stage.name}" (aviso a cada ${recurringDays} dias).` },
      is_active: true,
    }
    if (recurringRuleIds.length === 0) {
      const { error } = await supabase.from('automation_rules').insert({
        agency_id: agencyId,
        description: 'Criado pelo editor de notificações da etapa',
        trigger_type: 'stage_recurring',
        action_type: 'send_notification',
        ...row,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('automation_rules').update(row).in('id', recurringRuleIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (recurringRuleIds.length > 0) {
    const { error } = await supabase.from('automation_rules').delete().in('id', recurringRuleIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { state } = await readState(supabase, agencyId, id)
  return NextResponse.json(state)
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add app/api/pipeline-stages/[id]/notifications/route.ts
git commit -m "feat: support stage_days_after_entry/stage_recurring in stage notifications API"
```

---

### Task 8: UI — `StageNotificationsModal.tsx` com os 2 novos avisos

**Files:**
- Modify: `components/pipeline/StageNotificationsModal.tsx` (ficheiro completo)

- [ ] **Step 1: Reescrever o ficheiro**

Substituir todo o conteúdo de `components/pipeline/StageNotificationsModal.tsx` por:

```tsx
'use client'
import { useState, useEffect } from 'react'

type Props = {
  stageId: string
  stageName: string
  onClose: () => void
  onSaved?: () => void
}

type NotificationsState = {
  on_enter: boolean
  stale_days: number | null
  days_after_entry: number | null
  recurring_days: number | null
}

// Mini-editor dos avisos de uma etapa: "ao entrar", "parado há X dias",
// "X dias após entrar" e "a cada X dias" (recorrente).
// Lê/escreve via /api/pipeline-stages/[id]/notifications (regras de automação).
export function StageNotificationsModal({ stageId, stageName, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onEnter, setOnEnter] = useState(false)
  const [staleEnabled, setStaleEnabled] = useState(false)
  const [staleDays, setStaleDays] = useState('7')
  const [daysAfterEnabled, setDaysAfterEnabled] = useState(false)
  const [daysAfterValue, setDaysAfterValue] = useState('7')
  const [recurringEnabled, setRecurringEnabled] = useState(false)
  const [recurringValue, setRecurringValue] = useState('3')

  useEffect(() => {
    fetch(`/api/pipeline-stages/${stageId}/notifications`)
      .then(r => r.ok ? r.json() : { on_enter: false, stale_days: null, days_after_entry: null, recurring_days: null })
      .then((d: NotificationsState) => {
        setOnEnter(d.on_enter)
        setStaleEnabled(d.stale_days != null)
        if (d.stale_days != null) setStaleDays(String(d.stale_days))
        setDaysAfterEnabled(d.days_after_entry != null)
        if (d.days_after_entry != null) setDaysAfterValue(String(d.days_after_entry))
        setRecurringEnabled(d.recurring_days != null)
        if (d.recurring_days != null) setRecurringValue(String(d.recurring_days))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [stageId])

  async function save() {
    const days = Number(staleDays)
    if (staleEnabled && (!Number.isInteger(days) || days < 1)) {
      setError('Indica um número de dias válido (≥ 1) para "parado há X dias".')
      return
    }
    const daysAfter = Number(daysAfterValue)
    if (daysAfterEnabled && (!Number.isInteger(daysAfter) || daysAfter < 1)) {
      setError('Indica um número de dias válido (≥ 1) para "X dias após entrar".')
      return
    }
    const recurring = Number(recurringValue)
    if (recurringEnabled && (!Number.isInteger(recurring) || recurring < 1)) {
      setError('Indica um número de dias válido (≥ 1) para o aviso recorrente.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/pipeline-stages/${stageId}/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          on_enter: onEnter,
          stale_days: staleEnabled ? days : null,
          days_after_entry: daysAfterEnabled ? daysAfter : null,
          recurring_days: recurringEnabled ? recurring : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? 'Erro ao guardar avisos.')
        return
      }
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 92vw)', padding: 24 }}>
        <div className="font-display" style={{ fontSize: 16, marginBottom: 4 }}>🔔 Notificações da etapa</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{stageName}</div>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>A carregar…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={onEnter} onChange={e => setOnEnter(e.target.checked)} />
              Avisar quando um contacto entra nesta etapa
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', flexWrap: 'wrap' }}>
              <input type="checkbox" checked={staleEnabled} onChange={e => setStaleEnabled(e.target.checked)} />
              Avisar quando um contacto está parado há
              <input
                className="input"
                type="number"
                min={1}
                value={staleDays}
                disabled={!staleEnabled}
                onChange={e => setStaleDays(e.target.value)}
                style={{ width: 64, textAlign: 'center', opacity: staleEnabled ? 1 : 0.5 }}
              />
              dias nesta etapa
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', flexWrap: 'wrap' }}>
              <input type="checkbox" checked={daysAfterEnabled} onChange={e => setDaysAfterEnabled(e.target.checked)} />
              Avisar
              <input
                className="input"
                type="number"
                min={1}
                value={daysAfterValue}
                disabled={!daysAfterEnabled}
                onChange={e => setDaysAfterValue(e.target.value)}
                style={{ width: 64, textAlign: 'center', opacity: daysAfterEnabled ? 1 : 0.5 }}
              />
              dias depois de entrar nesta etapa
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', flexWrap: 'wrap' }}>
              <input type="checkbox" checked={recurringEnabled} onChange={e => setRecurringEnabled(e.target.checked)} />
              Avisar a cada
              <input
                className="input"
                type="number"
                min={1}
                value={recurringValue}
                disabled={!recurringEnabled}
                onChange={e => setRecurringValue(e.target.value)}
                style={{ width: 64, textAlign: 'center', opacity: recurringEnabled ? 1 : 0.5 }}
              />
              dias enquanto estiver nesta etapa
            </label>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Os avisos vão para o responsável do contacto e aparecem também em Definições → Automações.
            </div>
            {error && <div style={{ fontSize: 12, color: '#DC2626' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
              <button type="button" onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'A guardar…' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/StageNotificationsModal.tsx
git commit -m "feat: add days-after-entry and recurring options to stage notifications UI"
```

---

## Fase 2 — "+ Imóveis" na pipeline

### Task 9: Endpoint novo `add-properties`, remover `add-contacts`

**Files:**
- Create: `app/api/pipelines/[id]/add-properties/route.ts`
- Delete: `app/api/pipelines/[id]/add-contacts/route.ts`

- [ ] **Step 1: Escrever o endpoint novo**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Item = { property_id: string; person_id: string | null }

// Adiciona vários imóveis a esta pipeline de uma vez: cria um lead por
// par (imóvel, pessoa) na 1ª etapa da pipeline. Ao contrário do antigo
// endpoint de contactos, a mesma pessoa pode aparecer várias vezes desde
// que ligada a imóveis diferentes — o duplicado é bloqueado pela
// combinação (person_id, property_id), não só pela pessoa.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: pipelineId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const items: Item[] = Array.isArray(body.items)
    ? body.items.filter((i: unknown): i is Item =>
        !!i && typeof i === 'object' && typeof (i as Item).property_id === 'string')
    : []
  if (items.length === 0) return NextResponse.json({ added: 0 })

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .single()
  if (!pipeline) return NextResponse.json({ error: 'Pipeline inválida' }, { status: 404 })

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstStage) return NextResponse.json({ error: 'A pipeline não tem etapas. Cria uma etapa primeiro.' }, { status: 400 })

  // Pares (person_id, property_id) já ativos nesta pipeline, para não duplicar
  const propertyIds = [...new Set(items.map(i => i.property_id))]
  const { data: existing } = await supabase
    .from('leads')
    .select('person_id, property_id, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
    .in('property_id', propertyIds)
  const existingKeys = new Set((existing ?? []).map(l => `${l.person_id ?? ''}:${l.property_id}`))

  const toAdd = items.filter(i => !existingKeys.has(`${i.person_id ?? ''}:${i.property_id}`))
  if (toAdd.length === 0) return NextResponse.json({ added: 0 })

  const [{ data: properties }, { data: people }] = await Promise.all([
    supabase.from('properties').select('id, reference, title, zone, typology, price')
      .eq('agency_id', profile.agency_id)
      .in('id', toAdd.map(i => i.property_id)),
    supabase.from('people').select('id, name, email, phone')
      .eq('agency_id', profile.agency_id)
      .in('id', toAdd.filter(i => i.person_id).map(i => i.person_id as string)),
  ])
  const propertyById = new Map((properties ?? []).map(p => [p.id, p]))
  const personById = new Map((people ?? []).map(p => [p.id, p]))

  const rows = toAdd.map(item => {
    const property = propertyById.get(item.property_id)
    const person = item.person_id ? personById.get(item.person_id) : null
    if (!property) return null
    return {
      agency_id: profile.agency_id,
      name: person?.name ?? (property.reference ? `${property.reference} — ${property.title}` : property.title),
      email: person?.email ?? null,
      phone: person?.phone ?? null,
      stage_id: firstStage.id,
      pipeline_id: pipelineId,
      person_id: item.person_id,
      property_id: item.property_id,
      assigned_to: user.id,
      zone: property.zone,
      typology: property.typology,
      budget: property.price,
      source: 'outro',
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) return NextResponse.json({ added: 0 })

  const { error } = await supabase.from('leads').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ added: rows.length })
}
```

- [ ] **Step 2: Apagar o endpoint antigo**

```bash
rm app/api/pipelines/[id]/add-contacts/route.ts
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: erros esperados em `components/pipeline/ContactPickerModal.tsx` e `components/pipeline/PipelineBoard.tsx` (ainda referenciam o endpoint antigo) — resolvidos nas próximas tasks.

- [ ] **Step 4: Commit**

```bash
git add app/api/pipelines/[id]/add-properties/route.ts
git add -u app/api/pipelines/[id]/add-contacts/route.ts
git commit -m "feat: add add-properties endpoint, remove add-contacts"
```

---

### Task 10: Componente novo `PropertyPickerModal`, remover `ContactPickerModal`

**Files:**
- Create: `components/pipeline/PropertyPickerModal.tsx`
- Delete: `components/pipeline/ContactPickerModal.tsx`

- [ ] **Step 1: Escrever o componente novo**

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import type { Property, Person } from '@/types'

type SelectedItem = {
  property: Property
  personId: string | null
  personQuery: string
  personResults: Person[]
  showPersonDropdown: boolean
}

// Popup: pesquisa de imóveis (debounced, como no NewLeadModal), cada imóvel
// escolhido entra numa lista de selecionados onde também se escolhe a
// pessoa associada (pré-preenchida com o vendedor/comprador do imóvel,
// quando existir — sempre editável). Ao contrário do antigo picker de
// contactos, a mesma pessoa pode ser adicionada várias vezes desde que
// ligada a imóveis diferentes; duplicados exatos são filtrados no servidor.
export function PropertyPickerModal({ pipelineId, pipelineName, onClose, onAdded }: {
  pipelineId: string
  pipelineName: string
  onClose: () => void
  onAdded: () => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Property[]>([])
  const [selected, setSelected] = useState<SelectedItem[]>([])
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  useEffect(() => {
    if (!search) { setResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/properties?search=${encodeURIComponent(search)}`)
      if (res.ok) setResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearchDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function addProperty(property: Property) {
    setSearch('')
    setResults([])
    setShowSearchDropdown(false)
    setSelected(prev => [...prev, { property, personId: null, personQuery: '', personResults: [], showPersonDropdown: false }])

    const res = await fetch(`/api/properties/${property.id}`)
    if (!res.ok) return
    const full = await res.json() as { seller?: Person | null; buyer?: Person | null }
    const preselected = full.seller ?? full.buyer ?? null
    if (!preselected) return
    setSelected(prev => prev.map(item => item.property.id === property.id
      ? { ...item, personId: preselected.id, personQuery: preselected.name }
      : item))
  }

  function removeItem(propertyId: string) {
    setSelected(prev => prev.filter(item => item.property.id !== propertyId))
  }

  function updateItem(propertyId: string, patch: Partial<SelectedItem>) {
    setSelected(prev => prev.map(item => item.property.id === propertyId ? { ...item, ...patch } : item))
  }

  function searchPerson(propertyId: string, query: string) {
    updateItem(propertyId, { personQuery: query, showPersonDropdown: true })
    if (!query) { updateItem(propertyId, { personResults: [] }); return }
    fetch(`/api/people?search=${encodeURIComponent(query)}`)
      .then(r => r.ok ? r.json() : [])
      .then((people: Person[]) => updateItem(propertyId, { personResults: people }))
      .catch(() => {})
  }

  async function confirm() {
    if (selected.length === 0) { onClose(); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/add-properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected.map(s => ({ property_id: s.property.id, person_id: s.personId })),
        }),
      })
      if (res.ok) { onAdded(); onClose() }
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: '100%', maxWidth: 460, maxHeight: '85vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 16 }}>Adicionar imóveis <span style={{ color: 'var(--muted)', fontSize: 12 }}>→ {pipelineName}</span></div>
            <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <div ref={searchRef} style={{ position: 'relative' }}>
            <input
              className="input"
              placeholder="Pesquisar imóvel por referência, título ou morada…"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSearchDropdown(true) }}
              onFocus={() => setShowSearchDropdown(true)}
              autoFocus
            />
            {showSearchDropdown && search && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto', zIndex: 10 }}>
                {results.filter(p => !selected.some(s => s.property.id === p.id)).map(p => (
                  <div key={p.id} onClick={() => addProperty(p)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 500 }}>{p.reference ? `${p.reference} — ` : ''}{p.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.price ? `€${p.price.toLocaleString('pt-PT')}` : ''} {p.zone ?? ''}</div>
                  </div>
                ))}
                {results.length === 0 && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>Nenhum imóvel encontrado</div>}
              </div>
            )}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '10px 20px' }}>
          {selected.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Pesquisa e escolhe imóveis para adicionar.</div>
          ) : selected.map(item => (
            <div key={item.property.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.property.reference ? `${item.property.reference} — ` : ''}{item.property.title}</div>
                <button onClick={() => removeItem(item.property.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  style={inputStyle}
                  placeholder="Pessoa associada (opcional)…"
                  value={item.personQuery}
                  onChange={e => { updateItem(item.property.id, { personId: null }); searchPerson(item.property.id, e.target.value) }}
                  onFocus={() => updateItem(item.property.id, { showPersonDropdown: true })}
                />
                {item.showPersonDropdown && item.personQuery && !item.personId && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 140, overflowY: 'auto', zIndex: 10 }}>
                    {item.personResults.map(p => (
                      <div key={p.id} onClick={() => updateItem(item.property.id, { personId: p.id, personQuery: p.name, showPersonDropdown: false })} style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                        {p.name}
                      </div>
                    ))}
                    {item.personResults.length === 0 && <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--muted)' }}>Nenhuma pessoa encontrada</div>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button onClick={confirm} disabled={saving || selected.length === 0} className="btn btn-primary" style={{ flex: 1 }}>
            {saving ? 'A adicionar…' : `Adicionar${selected.length > 0 ? ` (${selected.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Apagar o componente antigo**

```bash
rm components/pipeline/ContactPickerModal.tsx
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: erro esperado em `components/pipeline/PipelineBoard.tsx` (ainda importa `ContactPickerModal`) — resolvido na próxima task.

- [ ] **Step 4: Commit**

```bash
git add components/pipeline/PropertyPickerModal.tsx
git add -u components/pipeline/ContactPickerModal.tsx
git commit -m "feat: add PropertyPickerModal, remove ContactPickerModal"
```

---

### Task 11: `PipelineBoard.tsx` — trocar o botão e remover `alreadyInIds`

**Files:**
- Modify: `components/pipeline/PipelineBoard.tsx`

- [ ] **Step 1: Trocar os imports**

Substituir:

```ts
import { useState, useEffect, useCallback, useMemo } from 'react'
```

por (`useMemo` deixa de ser usado no ficheiro depois do Step 2):

```ts
import { useState, useEffect, useCallback } from 'react'
```

Substituir:

```ts
import { ContactPickerModal } from '@/components/pipeline/ContactPickerModal'
```

por:

```ts
import { PropertyPickerModal } from '@/components/pipeline/PropertyPickerModal'
```

- [ ] **Step 2: Remover o cálculo de `alreadyInIds` (deixa de ser necessário — a deduplicação passa a ser feita no servidor por par pessoa+imóvel)**

Remover por completo este bloco:

```ts
  // Contactos já presentes nesta pipeline (lead ativa = etapa não won/lost)
  const alreadyInIds = useMemo(() => {
    const set = new Set<string>()
    for (const l of leads) {
      const st = l.pipeline_stages
      if (l.person_id && st && !st.is_won && !st.is_lost) set.add(l.person_id)
    }
    return set
  }, [leads])
```

- [ ] **Step 3: Trocar o modal renderizado**

Substituir:

```tsx
      {showPicker && selected && (
        <ContactPickerModal
          pipelineId={selected.id}
          pipelineName={selected.name}
          alreadyInIds={alreadyInIds}
          onClose={() => setShowPicker(false)}
          onAdded={() => selectedId && loadBoard(selectedId)}
        />
      )}
```

por:

```tsx
      {showPicker && selected && (
        <PropertyPickerModal
          pipelineId={selected.id}
          pipelineName={selected.name}
          onClose={() => setShowPicker(false)}
          onAdded={() => selectedId && loadBoard(selectedId)}
        />
      )}
```

- [ ] **Step 4: Trocar o texto do botão**

Substituir:

```tsx
          <button onClick={() => setShowPicker(true)} disabled={!selected} className="btn btn-ghost">+ Contactos</button>
```

por:

```tsx
          <button onClick={() => setShowPicker(true)} disabled={!selected} className="btn btn-ghost">+ Imóveis</button>
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add components/pipeline/PipelineBoard.tsx
git commit -m "feat: switch pipeline add button to properties instead of contacts"
```

---

### Task 12: Verificação manual da Fase 2 (card + fluxo de imóveis)

- [ ] **Step 1: Arrancar o dev server e testar**

Usar a skill `run` (ou `npm run dev` através da ferramenta de preview do browser, nunca via Bash) para:
1. Abrir a pipeline "Vendedores", configurar `card_primary_field = 'property'` em Definições → Pipeline (ou via `PipelineSettingsModal`).
2. Clicar "+ Imóveis", escolher um imóvel que tenha `seller_id` definido — confirmar que a pessoa vem pré-preenchida.
3. Adicionar. Confirmar que o card novo mostra a referência/título do imóvel (não o nome da pessoa) como texto principal.
4. Repetir com o mesmo imóvel + mesma pessoa — confirmar que a UI mostra "Adicionado (0)" implícito (o `added` da resposta deve ser 0; podes confirmar via `read_network_requests`).
5. Adicionar a mesma pessoa com um imóvel diferente — confirmar que aparecem dois cards distintos.

Não há passo de commit aqui — é só verificação; se algo falhar, voltar às tasks 9-11 para corrigir antes de avançar.

---

## Fase 3 — Telegram (envio)

### Task 13: `lib/telegram/send.ts`

**Files:**
- Create: `lib/telegram/send.ts`

- [ ] **Step 1: Escrever o ficheiro**

```ts
// Envio de mensagens Telegram (só envio — a receção de updates deste bot
// é responsabilidade do projeto idealista-bot, ver docs/TELEGRAM_SETUP.md).

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!isTelegramConfigured()) {
    throw new Error('Telegram não configurado (falta TELEGRAM_BOT_TOKEN)')
  }

  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  )

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(`Telegram API: ${data?.description ?? res.statusText}`)
  }
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/telegram/send.ts
git commit -m "feat: add Telegram send helper"
```

---

### Task 14: Ligar `lib/notifications.ts` ao envio Telegram

**Files:**
- Modify: `lib/notifications.ts`

- [ ] **Step 1: Importar o helper novo**

Adicionar no topo do ficheiro, junto aos outros imports:

```ts
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram/send'
```

- [ ] **Step 2: Incluir `telegram_chat_id` na query do utilizador**

Substituir:

```ts
  // 3. Verificar opt-out e enviar email
  const { data: userRow } = await supabase
    .from('users')
    .select('name, email_notifications')
    .eq('id', userId)
    .single()

  if (!userRow?.email_notifications) return
```

por:

```ts
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

  if (!userRow?.email_notifications) return
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: send notifications via Telegram when telegram_chat_id is set"
```

---

### Task 15: `docs/TELEGRAM_SETUP.md`

**Files:**
- Create: `docs/TELEGRAM_SETUP.md`

- [ ] **Step 1: Escrever o documento**

```markdown
# Configurar notificações por Telegram no ImoFlow

O ImoFlow envia todas as notificações do sistema (novas leads, mudanças de
etapa, avisos de automação — incluindo os novos avisos de etapa) também
por Telegram, além de email, quando o utilizador tem a conta ligada.

## O que já existe

- Cada utilizador liga a sua conta em **Definições → Equipa**, botão
  "Ligar Telegram" (abre `t.me/Imoflowbot?start=<id do utilizador>`).
- A coluna `public.users.telegram_chat_id` já existe na base de dados
  (criada pelo projeto `idealista-bot`, partilha a mesma base Supabase).

## O que falta para o botão funcionar

Ninguém responde ainda ao `/start` enviado pelo Telegram — é preciso um
processo com acesso ao `TELEGRAM_BOT_TOKEN` que:
1. Receba o update `/start <user_id>` (via webhook ou polling do bot
   `Imoflowbot`).
2. Grave `telegram_chat_id = <chat.id do update>` na linha de `users` com
   esse `id`.

Isto é responsabilidade do projeto `idealista-bot` (que já vai precisar de
receber updates deste mesmo bot para os botões dos cartões de imóveis) —
**não construir um segundo recetor aqui no ImoFlow**, para evitar dois
processos a competir pelas mesmas updates do Telegram (só um pode receber
de cada vez, via `setWebhook` ou `getUpdates`).

## Configurar o envio (este repositório)

No Vercel (Settings → Environment Variables) ou no `.env.local`:

```
TELEGRAM_BOT_TOKEN=<o token do bot @Imoflowbot, o mesmo do idealista-bot>
```

Depois faz redeploy. Não é preciso mais nenhum passo — `sendMessage` da
API do Telegram funciona com qualquer processo que tenha o token, mesmo
que não seja o que está a receber updates.

## Testar

1. Insere manualmente um `telegram_chat_id` de teste (o teu próprio chat
   com o bot) numa linha de `users`.
2. Cria uma lead nova atribuída a esse utilizador.
3. Deves receber a notificação no Telegram poucos segundos depois, em
   paralelo ao email (se `email_notifications` estiver ativo).
```

- [ ] **Step 2: Commit**

```bash
git add docs/TELEGRAM_SETUP.md
git commit -m "docs: add Telegram setup guide"
```

---

## Fase 4 — Verificação final

### Task 16: Type-check, lint e verificação manual completa

- [ ] **Step 1: Type-check completo**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 erros.

- [ ] **Step 3: Verificação manual no browser (usar a skill `run`, nunca Bash para o dev server)**

1. Pipeline: repetir o fluxo da Task 12 numa pipeline diferente de Vendedores (ex. Compradores/Investidores) para confirmar que "+ Imóveis" funciona em todas as pipelines e que a pessoa pode ser escolhida manualmente quando o imóvel não tem `seller_id`/`buyer_id`.
2. Notificações de etapa: em Definições → Pipeline, abrir os avisos de uma etapa, ativar as 4 opções (entrar / parado X dias / X dias após entrar / a cada X dias), guardar, reabrir o modal e confirmar que os valores persistem.
3. Confirmar em Definições → Automações que as 4 regras aparecem listadas com os `trigger_type` corretos.
4. Chamar manualmente `GET /api/cron/stage-notifications` com o header `Authorization: Bearer <CRON_SECRET>` (via `read_network_requests` ou um pedido direto) e confirmar que devolve `{ processed: N }` sem erro 500.

- [ ] **Step 4: Commit final (se algo tiver sido corrigido durante a verificação)**

Só se necessário — caso contrário, esta task não produz commit.
