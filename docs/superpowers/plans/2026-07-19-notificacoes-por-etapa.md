# Notificações por Etapa de Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada etapa de cada pipeline pode ter dois avisos configuráveis num 🔔 em Definições → Pipeline — "ao entrar na etapa" e "parado há X dias nesta etapa" — implementados como regras normais de automação.

**Architecture:** Zero migrações. O trigger `stage_changed` + `to_stage_id` já existe; o `lead_inactive` ganha um filtro opcional `stage_id` no engine (~6 linhas). Uma rota nova `GET/PUT /api/pipeline-stages/[id]/notifications` traduz `{ on_enter, stale_days }` ⇄ regras em `automation_rules` (apagar regra é seguro: `automation_logs.rule_id` tem ON DELETE CASCADE). Um mini-modal na página de Definições → Pipeline edita isso por etapa.

**Tech Stack:** Next.js 16 (rotas com `params: Promise<...>`), React 19, Supabase RLS. **Sem framework de testes** — verificação é `npx tsc --noEmit` + preview. Branch: continuar em `claude/cards-configuraveis` (o utilizador pediu para só fazer push no fim; nova branch `claude/notificacoes-etapa` a partir dela).

**Spec:** `docs/superpowers/specs/2026-07-19-notificacoes-por-etapa-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `lib/automations/engine.ts` | Modificar | Filtro `stage_id` nas regras `lead_inactive` |
| `app/api/pipeline-stages/[id]/notifications/route.ts` | Criar | GET/PUT do estado dos avisos da etapa |
| `components/pipeline/StageNotificationsModal.tsx` | Criar | Mini-editor dos dois avisos |
| `app/(app)/settings/pipeline/page.tsx` | Modificar | Botão 🔔 por etapa + badge de estado |

## Factos do código (verificados — não re-descobrir)

- `send_notification` no engine usa `rule.name` como título e `action_config.message` como corpo, notifica o `assigned_to` da lead com link `/leads/{id}` (engine.ts:174-184). Sem substituição de variáveis neste ramo — mensagens estáticas.
- `automation_logs.rule_id` → `ON DELETE CASCADE` (20260531_automations.sql) — apagar regras é seguro.
- `automation_rules` tem `agency_id NOT NULL` + RLS por agência; `GET /api/automations` devolve todas as regras da agência.
- A página `app/(app)/settings/pipeline/page.tsx` lista as etapas em `stages.map((stage, i) => ...)` numa `div.stage-row` com botões ▲▼, cor, nome, probabilidade, badges WON/LOST e ✕ no fim.
- O supabase-js suporta `.eq('trigger_config->>to_stage_id', id)` (filtro jsonb).

---

### Task 1: Engine + rota de notificações da etapa

**Files:**
- Modify: `lib/automations/engine.ts`
- Create: `app/api/pipeline-stages/[id]/notifications/route.ts`

- [ ] **Step 0: Criar o branch**

```bash
git checkout -b claude/notificacoes-etapa
```

- [ ] **Step 1: Filtro de etapa no engine**

Em `lib/automations/engine.ts`, no `triggerAutomations`, logo a seguir a `if (!lead) return`, inserir:

```ts
  // Regras de inatividade podem ser limitadas a uma etapa específica
  // (trigger_config.stage_id) — só disparam se a lead estiver nessa etapa.
  const stageFilteredRules = matchingRules.filter((rule: AutomationRule) => {
    if (rule.trigger_type !== 'lead_inactive') return true
    const cfgStage = (rule.trigger_config as Record<string, unknown>).stage_id
    return !cfgStage || cfgStage === lead.stage_id
  })
  if (stageFilteredRules.length === 0) return
```

E no loop de execução trocar `for (const rule of matchingRules)` por `for (const rule of stageFilteredRules)`. Nada mais muda no ficheiro.

- [ ] **Step 2: Rota `GET/PUT /api/pipeline-stages/[id]/notifications`**

Conteúdo completo de `app/api/pipeline-stages/[id]/notifications/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Avisos por etapa, guardados como regras normais de automação:
// - "ao entrar":  trigger stage_changed + trigger_config.to_stage_id
// - "parado Xd":  trigger lead_inactive + trigger_config.{stage_id, inactive_days}
// Ambas com action send_notification (responsável da lead). O editor por
// etapa é o dono destas regras: desligar um toggle APAGA a regra
// (automation_logs.rule_id tem on delete cascade).

type StageNotificationsState = { on_enter: boolean; stale_days: number | null }

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
  const [{ data: enterRules }, { data: staleRules }] = await Promise.all([
    supabase.from('automation_rules').select('id, is_active')
      .eq('agency_id', agencyId)
      .eq('trigger_type', 'stage_changed')
      .eq('trigger_config->>to_stage_id', stageId),
    supabase.from('automation_rules').select('id, is_active, trigger_config')
      .eq('agency_id', agencyId)
      .eq('trigger_type', 'lead_inactive')
      .eq('trigger_config->>stage_id', stageId),
  ])
  const enter = (enterRules ?? []).find(r => r.is_active)
  const stale = (staleRules ?? []).find(r => r.is_active)
  const staleDays = stale ? Number((stale.trigger_config as Record<string, unknown>).inactive_days ?? 0) || null : null
  return {
    state: { on_enter: !!enter, stale_days: staleDays } satisfies StageNotificationsState,
    enterRuleIds: (enterRules ?? []).map(r => r.id),
    staleRuleIds: (staleRules ?? []).map(r => r.id),
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

  const { enterRuleIds, staleRuleIds } = await readState(supabase, agencyId, id)

  // Sincronizar "ao entrar"
  if (onEnter && enterRuleIds.length === 0) {
    const { error } = await supabase.from('automation_rules').insert({
      agency_id: agencyId,
      name: `Etapa ${stage.name}: aviso de entrada`,
      description: 'Criado pelo editor de notificações da etapa',
      trigger_type: 'stage_changed',
      trigger_config: { to_stage_id: id },
      action_type: 'send_notification',
      action_config: { message: `Um contacto entrou na etapa "${stage.name}".` },
      pipeline_id: stage.pipeline_id,
      is_active: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (!onEnter && enterRuleIds.length > 0) {
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
      const { error } = await supabase.from('automation_rules').insert({
        agency_id: agencyId,
        description: 'Criado pelo editor de notificações da etapa',
        trigger_type: 'lead_inactive',
        action_type: 'send_notification',
        pipeline_id: stage.pipeline_id,
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

  const { state } = await readState(supabase, agencyId, id)
  return NextResponse.json(state)
}
```

- [ ] **Step 3: Type-check e commit**

```bash
npx tsc --noEmit
git add lib/automations/engine.ts "app/api/pipeline-stages/[id]/notifications/route.ts"
git commit -m "feat: avisos por etapa como regras de automação (engine + API)"
```

---

### Task 2: Modal 🔔 + botão na página de Definições → Pipeline

**Files:**
- Create: `components/pipeline/StageNotificationsModal.tsx`
- Modify: `app/(app)/settings/pipeline/page.tsx`

- [ ] **Step 1: Criar o modal**

Conteúdo completo de `components/pipeline/StageNotificationsModal.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'

type Props = {
  stageId: string
  stageName: string
  onClose: () => void
  onSaved?: () => void
}

// Mini-editor dos avisos de uma etapa: "ao entrar" e "parado há X dias".
// Lê/escreve via /api/pipeline-stages/[id]/notifications (regras de automação).
export function StageNotificationsModal({ stageId, stageName, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onEnter, setOnEnter] = useState(false)
  const [staleEnabled, setStaleEnabled] = useState(false)
  const [staleDays, setStaleDays] = useState('7')

  useEffect(() => {
    fetch(`/api/pipeline-stages/${stageId}/notifications`)
      .then(r => r.ok ? r.json() : { on_enter: false, stale_days: null })
      .then((d: { on_enter: boolean; stale_days: number | null }) => {
        setOnEnter(d.on_enter)
        setStaleEnabled(d.stale_days != null)
        if (d.stale_days != null) setStaleDays(String(d.stale_days))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [stageId])

  async function save() {
    const days = Number(staleDays)
    if (staleEnabled && (!Number.isInteger(days) || days < 1)) {
      setError('Indica um número de dias válido (≥ 1).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/pipeline-stages/${stageId}/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on_enter: onEnter, stale_days: staleEnabled ? days : null }),
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(400px, 92vw)', padding: 24 }}>
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

- [ ] **Step 2: Botão 🔔 + badge na página**

Em `app/(app)/settings/pipeline/page.tsx`:

1. Imports/estado (junto aos outros `useState`):

```tsx
import { StageNotificationsModal } from '@/components/pipeline/StageNotificationsModal'
// ...
  const [notifStage, setNotifStage] = useState<PipelineStage | null>(null)
  // etapas com avisos ativos (para o 🔔 dourado) — derivado das regras da agência
  const [notifiedStageIds, setNotifiedStageIds] = useState<Set<string>>(new Set())
```

2. Função + carregamento (junto aos outros fetch/useEffect da página):

```tsx
  // Deriva das regras de automação quais etapas têm avisos ativos
  async function loadNotifiedStages() {
    try {
      const res = await fetch('/api/automations')
      if (!res.ok) return
      const rules: { is_active: boolean; trigger_type: string; trigger_config: Record<string, unknown> }[] = await res.json()
      const ids = new Set<string>()
      for (const r of rules) {
        if (!r.is_active) continue
        if (r.trigger_type === 'stage_changed' && typeof r.trigger_config?.to_stage_id === 'string') ids.add(r.trigger_config.to_stage_id)
        if (r.trigger_type === 'lead_inactive' && typeof r.trigger_config?.stage_id === 'string') ids.add(r.trigger_config.stage_id)
      }
      setNotifiedStageIds(ids)
    } catch { /* badge é decorativo */ }
  }

  useEffect(() => { loadNotifiedStages() }, [])
```

3. No JSX da `stage-row`, ANTES do botão ✕ existente, o botão 🔔:

```tsx
                <button
                  onClick={() => setNotifStage(stage)}
                  title="Notificações desta etapa"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 4px', filter: notifiedStageIds.has(stage.id) ? 'none' : 'grayscale(1) opacity(0.45)' }}
                >
                  🔔
                </button>
```

4. Render do modal (junto ao topo do JSX da página, fora do map):

```tsx
      {notifStage && (
        <StageNotificationsModal
          stageId={notifStage.id}
          stageName={notifStage.name}
          onClose={() => setNotifStage(null)}
          onSaved={loadNotifiedStages}
        />
      )}
```

- [ ] **Step 3: Type-check e commit**

```bash
npx tsc --noEmit
git add components/pipeline/StageNotificationsModal.tsx "app/(app)/settings/pipeline/page.tsx"
git commit -m "feat: editor de notificações por etapa em Definições → Pipeline"
```

---

### Task 3: Verificação final

- [ ] **Step 1: Build**

```bash
npm run build
```
Expected: sem erros.

- [ ] **Step 2: Preview** (dados reais — usar uma etapa pouco movimentada e reverter no fim)

1. Definições → Pipeline: cada etapa mostra 🔔 acinzentado; abrir numa etapa de teste, ativar "entrada" + "parado 7 dias", guardar → 🔔 fica dourado.
2. Definições → Automações: aparecem as duas regras `Etapa {nome}: aviso de entrada` e `Etapa {nome}: parado 7 dias`.
3. Reabrir o 🔔 → estado pré-preenchido (GET); desligar "entrada", guardar → regra de entrada desaparece de Automações; a de parado mantém-se.
4. (Opcional, mexe em dados reais) Mover um lead para a etapa com aviso de entrada → sino mostra a notificação; mover de volta.
5. Desligar tudo na etapa de teste no fim (limpar regras).
6. Consola sem erros novos.

- [ ] **Step 3: Commit final (só se a verificação obrigar a correções)**

```bash
git add -A && git commit -m "fix: ajustes da verificação (notificações por etapa)"
```
