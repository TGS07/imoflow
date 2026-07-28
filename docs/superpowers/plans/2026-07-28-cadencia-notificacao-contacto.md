# Cadência de Notificação Efetiva por Contacto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na ficha do contacto, mostrar sempre a cadência de notificação que efetivamente se aplica (valor próprio do contacto → cadência recorrente da etapa de cada lead ativo → prazos da agência), permitir editar o valor do contacto a partir daí, e suprimir o aviso recorrente da etapa (`stage_recurring`) para leads cujo contacto tenha um ritmo próprio definido.

**Architecture:** Três alterações cirúrgicas, sem tabela nova nem endpoint novo. (1) `GET /api/people/[id]` passa a anexar `stage_recurring_days` a cada lead devolvido, calculado com uma query extra a `automation_rules` filtrada por `trigger_type='stage_recurring'`. (2) `ContactDetailPanel.tsx` deixa de esconder o bloco "Follow-ups" atrás de `person.is_regular`, mostra sempre a cadência efetiva (calculada em JS com a prioridade da spec) e liga `is_regular=true` automaticamente ao definir um intervalo. (3) O cron `stage-notifications` ganha uma lookup barata (uma query, sem N+1) aos `person_id` das leads ativas, e salta só a regra `stage_recurring` para leads cujo contacto tenha `is_regular=true` e `regular_interval_days` definido.

**Tech Stack:** Next.js 16 (rotas com `params: Promise<...>`), React 19, Supabase (Postgres + RLS). **Sem framework de testes** — verificação é `npx tsc --noEmit` + `npm run build` + preview manual / `curl` / `execute_sql`. Branch: continuar em `claude/notifications-contacts-calendar-9f9f44` (já é o branch ativo neste worktree — sem criar branch nova).

**Spec:** `docs/superpowers/specs/2026-07-28-cadencia-notificacao-contacto-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `app/api/people/[id]/route.ts` | Modificar | `GET` anexa `stage_recurring_days` a cada lead devolvido |
| `components/contacts/ContactDetailPanel.tsx` | Modificar | `LeadSummary` ganha o campo; bloco "Follow-ups" sempre visível com a cadência efetiva; `setRegularInterval` liga `is_regular` automaticamente |
| `app/api/cron/stage-notifications/route.ts` | Modificar | Lookup de `person_id` → `is_regular`/`regular_interval_days`; salta `stage_recurring` para leads com ritmo próprio no contacto |

Nenhuma migração, nenhum novo endpoint, nenhuma alteração a `types/index.ts` — todos os campos usados (`people.is_regular`, `people.regular_interval_days`, `leads.person_id`, `automation_rules.trigger_type`/`trigger_config`) já existem.

## Factos do código (verificados — não re-descobrir)

- **`GET /api/people/[id]`** (`app/api/people/[id]/route.ts:10-17`) já devolve `leads(id, name, stage_id, pipeline_id, deal_value, expected_close_date, created_at, pipeline_stages(name, color, is_won, is_lost), pipelines(name))` numa única query aninhada. Nenhum outro ficheiro do projeto consome este endpoint por `GET` além de `ContactDetailPanel.tsx` (confirmado por grep a `` /api/people/${ `` — `organizations/[id]/page.tsx` e `properties/[id]/page.tsx` fazem fetch a rotas diferentes) — por isso alargar a resposta é seguro, sem consumidores escondidos a proteger.
- **Padrão exato para filtrar `automation_rules` por um campo dentro de `trigger_config` (jsonb)**, já usado 4x em `app/api/pipeline-stages/[id]/notifications/route.ts:40-52`: `.eq('trigger_config->>stage_id', stageId)`. Não há, no código atual, nenhum uso de `.in()` sobre um caminho jsonb — para não arriscar uma sintaxe não verificada, a Task 1 usa o mesmo padrão do motor de automações (`lib/automations/engine.ts`, função `matchesTriggerConfig`): busca todas as regras `stage_recurring` ativas (a query já é implicitamente filtrada por agência via RLS, como todo o resto desta rota) e filtra `stage_id`/`interval_days` em JS. É um punhado de regras por agência, não um scan caro.
- **`people.is_regular` + `regular_interval_days` já são editáveis via `PATCH /api/people/[id]`** — ambos já estão na allowlist (`app/api/people/[id]/route.ts:34-36`), não precisa de alteração nenhuma nesse endpoint para a Task 2.
- **`ContactDetailPanel.tsx`, secção "Acompanhamento" (`cardTitle('Acompanhamento')`, linha 523)** tem hoje três blocos: "Follow-ups" (526-551), "Datas importantes" (554-597) e "Calendário" (600-606). O bloco "Follow-ups" esconde a frequência e o editor de intervalo inteiro atrás de `{person.is_regular && (...)}` (534-550) — é exatamente essa condição que a Task 2 remove; o `<button onClick={toggleRegular}>` (529-532) fica fora dessa condição e continua a existir tal como está.
- **`activeLeads`** já é calculado em `ContactDetailPanel.tsx:303`: `(person.leads ?? []).filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)`. A Task 1 usa exatamente o mesmo critério do lado do servidor para decidir de que `stage_id` vale a pena ir buscar `stage_recurring_days` (evita computar para leads fechadas/perdidas).
- **`REGULAR_INTERVAL_PRESETS`** vem de `lib/contacts/special-dates.ts:4` (`[5, 7, 15, 30, 60, 90]`) e já está importado em `ContactDetailPanel.tsx:15` — nenhum import novo.
- **`GET /api/agency`** (`app/api/agency/route.ts:17-19`) já devolve `followup_first_days`/`followup_second_days` da agência do utilizador autenticado — reaproveitado pela Task 2 para a mensagem "prazos da agência" (o mesmo padrão de fallback `?? 7`/`?? 30` já usado em `app/api/cron/contact-followup/route.ts:63-64` e em `app/(app)/dashboard/page.tsx:33-34`).
- **`app/api/cron/stage-notifications/route.ts`** hoje seleciona leads com `.select('id, assigned_to, agency_id, stage_id, stage_entered_at, pipeline_stages!inner(is_won, is_lost)')` (linha 63) — **sem `person_id`**. Precisa de ser acrescentado. O loop principal (linhas 72-97) percorre `stage_days_after_entry` e `stage_recurring` para cada lead num único `for...of`; a supressão entra dentro desse loop, por tipo, não por lead inteiro (os outros três avisos de etapa continuam a disparar).
- **Padrão de lookup em lote (evita N+1)**, já usado em `app/api/cron/contact-followup/route.ts:112-124`: juntar todos os ids relevantes num array, uma única query com `.in('id', ids)`, e construir um `Map`/`Set` antes do loop principal. A Task 3 replica esse padrão para `person_id`.
- **`triggerAutomations` (`lib/automations/engine.ts`) é a fonte de verdade da correspondência** — o cron só faz uma pré-verificação barata (`ruleMatchesLead`, linhas 23-35) para decidir se vale a pena chamar `triggerAutomations`. A supressão da Task 3 tem de acontecer **antes** dessa chamada (não dentro de `engine.ts`), porque a spec só quer suprimir a partir do sinal "contacto tem ritmo próprio", que o motor de automações não conhece e não deve passar a conhecer (fora de âmbito da spec).
- **Sem framework de testes no projeto** — confirmado nos planos anteriores (`package.json` só tem `dev`/`build`/`start`/`lint`). Verificação via `npx tsc --noEmit` + `npm run build` + preview manual/`curl`/`execute_sql`, sem introduzir test runner novo.

---

### Task 1: API — `stage_recurring_days` por lead em `GET /api/people/[id]`

**Files:**
- Modify: `app/api/people/[id]/route.ts`

- [ ] **Step 1: Adicionar o cálculo de `stage_recurring_days`** — em `app/api/people/[id]/route.ts`, substituir o corpo de `GET`:

```ts
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('people')
    .select(`*, leads(id, name, stage_id, pipeline_id, deal_value, expected_close_date, created_at, pipeline_stages(name, color, is_won, is_lost), pipelines(name)),
      properties_as_seller:properties!seller_id(id, title, status, price, reference),
      properties_as_buyer:properties!buyer_id(id, title, status, price, reference),
      property_consultants(id, properties(id, title, status, price, reference))`)
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json(data)
}
```

por:

```ts
type LeadWithStage = {
  id: string
  stage_id: string
  pipeline_stages?: { is_won: boolean; is_lost: boolean } | null
  [key: string]: unknown
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('people')
    .select(`*, leads(id, name, stage_id, pipeline_id, deal_value, expected_close_date, created_at, pipeline_stages(name, color, is_won, is_lost), pipelines(name)),
      properties_as_seller:properties!seller_id(id, title, status, price, reference),
      properties_as_buyer:properties!buyer_id(id, title, status, price, reference),
      property_consultants(id, properties(id, title, status, price, reference))`)
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  // Cadência efetiva de notificação (ver spec
  // 2026-07-28-cadencia-notificacao-contacto-design.md): para cada lead
  // ativo (etapa não ganha/perdida), expor o interval_days da regra
  // `stage_recurring` da etapa atual, se existir. Vai buscar todas as regras
  // `stage_recurring` ativas (RLS já restringe à agência do utilizador,
  // como o resto desta rota) e filtra em JS — mesmo padrão de
  // `matchesTriggerConfig` em lib/automations/engine.ts. Evita N+1: uma
  // query, não uma por lead.
  const leads = (data.leads ?? []) as LeadWithStage[]
  const activeStageIds = new Set(
    leads
      .filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
      .map(l => l.stage_id)
  )

  const stageRecurringByStage = new Map<string, number>()
  if (activeStageIds.size > 0) {
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('trigger_config')
      .eq('trigger_type', 'stage_recurring')
      .eq('is_active', true)
    for (const rule of rules ?? []) {
      const cfg = rule.trigger_config as Record<string, unknown>
      const stageId = cfg.stage_id as string | undefined
      const intervalDays = Number(cfg.interval_days ?? 0)
      if (stageId && activeStageIds.has(stageId) && intervalDays > 0) {
        stageRecurringByStage.set(stageId, intervalDays)
      }
    }
  }

  const leadsWithRecurring = leads.map(l => ({
    ...l,
    stage_recurring_days: stageRecurringByStage.get(l.stage_id) ?? null,
  }))

  return NextResponse.json({ ...data, leads: leadsWithRecurring })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Esperado: sem erros novos relacionados com `app/api/people/[id]/route.ts`.

- [ ] **Step 3: Verificação manual rápida com `curl`** (precisa do servidor local a correr — `npm run dev` — e de uma sessão autenticada; se não houver forma fácil de obter um cookie de sessão via `curl`, adiar esta verificação pontual para o Step de preview manual da Task 4, que já usa o browser)

```bash
curl -s http://localhost:3000/api/people/<id-de-um-contacto-com-lead-ativo-numa-etapa-com-stage_recurring> \
  -H "Cookie: <cookie-de-sessao>" | jq '.leads[] | {id, stage_id, stage_recurring_days}'
```

Esperado: o lead ativo cuja etapa tem uma regra `stage_recurring` ativa mostra `stage_recurring_days` com o `interval_days` configurado; leads noutras etapas (sem regra) mostram `null`.

- [ ] **Step 4: Commit**

```bash
git add app/api/people/\[id\]/route.ts
git commit -m "feat: expor stage_recurring_days por lead em GET /api/people/[id]"
```

---

### Task 2: UI — cadência efetiva sempre visível na ficha do contacto

**Files:**
- Modify: `components/contacts/ContactDetailPanel.tsx`

- [ ] **Step 1: `LeadSummary` ganha o novo campo** — em `components/contacts/ContactDetailPanel.tsx:17-27`, substituir:

```ts
export type LeadSummary = {
  id: string
  name: string
  stage_id: string
  pipeline_id: string | null
  deal_value: number | null
  expected_close_date: string | null
  created_at: string
  pipeline_stages?: { name: string; color: string; is_won: boolean; is_lost: boolean }
  pipelines?: { name: string } | null
}
```

por:

```ts
export type LeadSummary = {
  id: string
  name: string
  stage_id: string
  pipeline_id: string | null
  deal_value: number | null
  expected_close_date: string | null
  created_at: string
  pipeline_stages?: { name: string; color: string; is_won: boolean; is_lost: boolean }
  pipelines?: { name: string } | null
  stage_recurring_days?: number | null
}
```

- [ ] **Step 2: Estado para os prazos da agência** — em `components/contacts/ContactDetailPanel.tsx`, a seguir a `const [customInterval, setCustomInterval] = useState('')` (linha 59), acrescentar:

```ts
  const [agencyFollowup, setAgencyFollowup] = useState({ first: 7, second: 30 })
```

- [ ] **Step 3: Fetch dos prazos da agência** — a seguir ao `useEffect` que busca `/api/pipelines` (`components/contacts/ContactDetailPanel.tsx:88-90`):

```ts
  useEffect(() => {
    fetch('/api/pipelines').then(r => r.ok ? r.json() : []).then(setPipelines).catch(() => {})
  }, [])
```

acrescentar logo a seguir:

```ts
  useEffect(() => {
    fetch('/api/agency')
      .then(r => r.ok ? r.json() : null)
      .then((d: { followup_first_days?: number; followup_second_days?: number } | null) => {
        if (d) setAgencyFollowup({ first: d.followup_first_days ?? 7, second: d.followup_second_days ?? 30 })
      })
      .catch(() => {})
  }, [])
```

- [ ] **Step 4: `setRegularInterval` liga `is_regular` automaticamente** — em `components/contacts/ContactDetailPanel.tsx:149-160`, substituir:

```ts
  // Frequência de follow-up própria deste contacto (substitui os prazos
  // globais da agência quando definida). null = voltar a usar os prazos da agência.
  async function setRegularInterval(days: number | null) {
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regular_interval_days: days }),
    })
    setCustomInterval('')
    fetchPerson()
    onChanged?.()
  }
```

por:

```ts
  // Frequência de follow-up própria deste contacto (substitui os prazos
  // globais da agência, e também o aviso recorrente da etapa de cada lead
  // ativo, quando definida — ver cron stage-notifications). null = voltar a
  // usar os prazos da agência (ou a cadência da etapa, se houver). Escolher
  // um valor liga is_regular automaticamente, se ainda não estiver ligado —
  // sem isso, nem este editor nem o cron contact-followup fariam efeito.
  async function setRegularInterval(days: number | null) {
    const body: Record<string, unknown> = { regular_interval_days: days }
    if (days != null && !person?.is_regular) body.is_regular = true
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setCustomInterval('')
    fetchPerson()
    onChanged?.()
  }
```

- [ ] **Step 5: Calcular `leadsWithStageCadence`** — em `components/contacts/ContactDetailPanel.tsx:303`, a seguir a `activeLeads`:

```ts
  // Leads "ativas" = etapa não fechada/perdida; pode haver uma por pipeline
  const activeLeads = (person.leads ?? []).filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
```

acrescentar logo a seguir:

```ts
  // Leads ativas cuja etapa atual tem um aviso recorrente configurado —
  // usadas para mostrar a cadência herdada quando o contacto não tem valor
  // próprio definido (prioridade 2 da spec de cadência efetiva).
  const leadsWithStageCadence = activeLeads.filter(l => l.stage_recurring_days != null && l.stage_recurring_days > 0)
```

- [ ] **Step 6: Bloco "Follow-ups" sempre visível com a cadência efetiva** — em `components/contacts/ContactDetailPanel.tsx:526-551`, substituir:

```tsx
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>Follow-ups</div>
                  <button onClick={toggleRegular} className={`chip${person.is_regular ? ' active' : ''}`} style={{ width: '100%', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 10 }}>
                    <span style={{ fontSize: 'var(--fs-sm)' }}>{person.is_regular ? '✓ Contacto regular' : 'Marcar como regular'}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.75, fontWeight: 500 }}>{person.is_regular ? 'lembretes ativos' : 'sem lembretes'}</span>
                  </button>

                  {person.is_regular && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                        Frequência: <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{person.regular_interval_days ? `a cada ${person.regular_interval_days} dias` : 'prazos da agência (padrão)'}</strong>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        <button type="button" onClick={() => setRegularInterval(null)} className={`chip${person.regular_interval_days == null ? ' active' : ''}`}>Prazos da agência</button>
                        {REGULAR_INTERVAL_PRESETS.map(dd => (
                          <button key={dd} type="button" onClick={() => setRegularInterval(dd)} className={`chip${person.regular_interval_days === dd ? ' active' : ''}`}>{dd} dias</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="input" style={{ width: 110 }} type="number" min={1} placeholder="outro (dias)" value={customInterval} onChange={e => setCustomInterval(e.target.value)} />
                        <button type="button" disabled={!customInterval} onClick={() => setRegularInterval(Number(customInterval))} className="btn btn-ghost btn-sm" style={{ height: 'auto' }}>Aplicar</button>
                      </div>
                    </div>
                  )}
                </div>
```

por:

```tsx
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>Follow-ups</div>

                  {/* Cadência efetiva: valor próprio do contacto → cadência da
                      etapa de cada lead ativo → prazos da agência (nesta ordem). */}
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
                    Cadência efetiva:{' '}
                    {person.regular_interval_days != null ? (
                      <strong style={{ color: 'var(--text)', fontWeight: 600 }}>a cada {person.regular_interval_days} dias (definido para este contacto)</strong>
                    ) : leadsWithStageCadence.length > 0 ? (
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                        {leadsWithStageCadence.map(lead => (
                          <strong key={lead.id} style={{ color: 'var(--text)', fontWeight: 600 }}>
                            «{lead.pipelines?.name ?? 'Negócio'}» (etapa «{lead.pipeline_stages?.name ?? '—'}»): a cada {lead.stage_recurring_days} dias, definido na etapa
                          </strong>
                        ))}
                      </span>
                    ) : (
                      <strong style={{ color: 'var(--text)', fontWeight: 600 }}>prazos da agência (padrão: primeiro aviso aos {agencyFollowup.first} dias, depois aos {agencyFollowup.second} dias)</strong>
                    )}
                  </div>

                  <button onClick={toggleRegular} className={`chip${person.is_regular ? ' active' : ''}`} style={{ width: '100%', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 10 }}>
                    <span style={{ fontSize: 'var(--fs-sm)' }}>{person.is_regular ? '✓ Contacto regular' : 'Marcar como regular'}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.75, fontWeight: 500 }}>{person.is_regular ? 'lembretes ativos' : 'sem lembretes'}</span>
                  </button>

                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                      Frequência: <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{person.regular_interval_days ? `a cada ${person.regular_interval_days} dias` : 'prazos da agência (padrão)'}</strong>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      <button type="button" onClick={() => setRegularInterval(null)} className={`chip${person.regular_interval_days == null ? ' active' : ''}`}>Prazos da agência</button>
                      {REGULAR_INTERVAL_PRESETS.map(dd => (
                        <button key={dd} type="button" onClick={() => setRegularInterval(dd)} className={`chip${person.regular_interval_days === dd ? ' active' : ''}`}>{dd} dias</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="input" style={{ width: 110 }} type="number" min={1} placeholder="outro (dias)" value={customInterval} onChange={e => setCustomInterval(e.target.value)} />
                      <button type="button" disabled={!customInterval} onClick={() => setRegularInterval(Number(customInterval))} className="btn btn-ghost btn-sm" style={{ height: 'auto' }}>Aplicar</button>
                    </div>
                  </div>
                </div>
```

Nota: o mini-resumo "Frequência: ..." dentro do editor (agora sempre visível) fica redundante com a nova linha "Cadência efetiva" quando `person.regular_interval_days` está definido, mas continua a fazer sentido como confirmação do valor bruto do contacto mesmo quando a cadência efetiva mostrada em cima vem da etapa (porque nesse caso "Frequência" mostra "prazos da agência (padrão)", que é o valor bruto do campo do contacto, distinto da cadência efetiva herdada da etapa) — mantém-se tal como está, sem alteração de texto.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Esperado: sem erros novos relacionados com `components/contacts/ContactDetailPanel.tsx`.

- [ ] **Step 8: Commit**

```bash
git add components/contacts/ContactDetailPanel.tsx
git commit -m "feat: mostrar sempre a cadência de notificação efetiva na ficha do contacto"
```

---

### Task 3: Cron `stage-notifications` — suprimir `stage_recurring` para contactos com ritmo próprio

**Files:**
- Modify: `app/api/cron/stage-notifications/route.ts`

- [ ] **Step 1: Trazer `person_id` e construir o `Set` de contactos com ritmo próprio** — em `app/api/cron/stage-notifications/route.ts:61-97`, substituir:

```ts
  const { data: leads } = await supabase
    .from('leads')
    .select('id, assigned_to, agency_id, stage_id, stage_entered_at, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)

  if (!leads || leads.length === 0) return NextResponse.json({ processed: 0 })

  const now = Date.now()
  let processed = 0

  for (const lead of leads) {
    if (!lead.assigned_to || !lead.agency_id) continue

    const agencyRules = rulesByAgency.get(lead.agency_id)
    if (!agencyRules || agencyRules.length === 0) continue

    const enteredAt = new Date(lead.stage_entered_at).getTime()
    const daysSinceStageEntry = Math.floor((now - enteredAt) / (24 * 60 * 60 * 1000))
    if (daysSinceStageEntry <= 0) continue

    for (const type of ['stage_days_after_entry', 'stage_recurring'] as const) {
      const hasPlausibleMatch = agencyRules.some(
        rule => rule.trigger_type === type && ruleMatchesLead(rule, lead.stage_id, daysSinceStageEntry)
      )
      if (!hasPlausibleMatch) continue

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
```

por:

```ts
  const { data: leads } = await supabase
    .from('leads')
    .select('id, assigned_to, agency_id, stage_id, stage_entered_at, person_id, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)

  if (!leads || leads.length === 0) return NextResponse.json({ processed: 0 })

  // Contactos com ritmo próprio definido: a cadência recorrente da etapa não
  // se aplica às leads desses contactos (ver spec
  // 2026-07-28-cadencia-notificacao-contacto-design.md) — só o aviso
  // "stage_recurring" é suprimido; os outros três (entrada, parado há X
  // dias, X dias após entrada) continuam a disparar normalmente. Uma única
  // query para todos os person_id envolvidos (mesmo padrão de
  // app/api/cron/contact-followup/route.ts), para evitar N+1.
  const personIds = [...new Set(leads.map(l => l.person_id).filter((p): p is string => !!p))]
  const regularPersonIds = new Set<string>()
  if (personIds.length > 0) {
    const { data: people } = await supabase
      .from('people')
      .select('id, is_regular, regular_interval_days')
      .in('id', personIds)
    for (const p of people ?? []) {
      if (p.is_regular && p.regular_interval_days != null) regularPersonIds.add(p.id)
    }
  }

  const now = Date.now()
  let processed = 0

  for (const lead of leads) {
    if (!lead.assigned_to || !lead.agency_id) continue

    const agencyRules = rulesByAgency.get(lead.agency_id)
    if (!agencyRules || agencyRules.length === 0) continue

    const enteredAt = new Date(lead.stage_entered_at).getTime()
    const daysSinceStageEntry = Math.floor((now - enteredAt) / (24 * 60 * 60 * 1000))
    if (daysSinceStageEntry <= 0) continue

    const hasOwnCadence = !!lead.person_id && regularPersonIds.has(lead.person_id)

    for (const type of ['stage_days_after_entry', 'stage_recurring'] as const) {
      if (type === 'stage_recurring' && hasOwnCadence) continue

      const hasPlausibleMatch = agencyRules.some(
        rule => rule.trigger_type === type && ruleMatchesLead(rule, lead.stage_id, daysSinceStageEntry)
      )
      if (!hasPlausibleMatch) continue

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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Esperado: sem erros novos relacionados com `app/api/cron/stage-notifications/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/stage-notifications/route.ts
git commit -m "fix: suprimir aviso recorrente da etapa para contactos com ritmo proprio"
```

---

### Task 4: Build + verificação manual final (coordenador)

- [ ] **Step 1: Build**

```bash
npm run build
```

Esperado: build sem erros. Se `npm run build` falhar por algo não relacionado com esta fatia (ex. env vars em falta no ambiente local), documentar e seguir para o preview manual na mesma.

- [ ] **Step 2: Preparar dados de teste via `execute_sql`** (usar o MCP Supabase do projeto real, ou o Supabase local se for esse o ambiente de desenvolvimento)

1. Escolher (ou criar) um contacto `P1` com `is_regular = false`, `regular_interval_days = null`.
2. Confirmar que existe uma etapa `E1` (de uma pipeline qualquer) com uma regra `automation_rules` ativa, `trigger_type = 'stage_recurring'`, `trigger_config = {"stage_id": "<E1>", "interval_days": <N>}`. Se não existir, criar uma via `PUT /api/pipeline-stages/<E1>/notifications` com `{ recurring_days: N }` (endpoint já existente, usado pelo `StageNotificationsModal`).
3. Garantir que `P1` tem uma lead ativa nessa etapa `E1` (`leads.person_id = P1`, `leads.stage_id = E1`, `stage_entered_at` no passado o suficiente para `daysSinceStageEntry % N === 0`, ex. `now() - interval 'N days'`).

- [ ] **Step 3: Testar "Contacto sem `is_regular`, com lead na etapa `stage_recurring`" (mapeia o 2º ponto de "Testes" da spec)**

1. Abrir a ficha de `P1` no browser (`/people/<P1>`).
2. Confirmar que a secção "Acompanhamento" → "Follow-ups" mostra "Cadência efetiva: «Nome do negócio» (etapa «E1»): a cada N dias, definido na etapa" — não "prazos da agência".
3. Correr o cron manualmente:

```bash
curl -s -X POST http://localhost:3000/api/cron/stage-notifications \
  -H "Authorization: Bearer $CRON_SECRET"
```

4. Confirmar via `execute_sql` que existe uma linha nova em `automation_logs` para a regra `stage_recurring` de `E1` e a lead de `P1` (`select * from automation_logs where lead_id = '<lead-id>' order by triggered_at desc limit 5;`).

- [ ] **Step 4: Testar "Contacto com `regular_interval_days` definido + lead na etapa `stage_recurring`" (mapeia o 3º ponto de "Testes" da spec — o caso central da funcionalidade)**

1. Na ficha de `P1`, no editor de frequência (agora sempre visível), escolher um preset diferente de N (ex. 15 dias).
2. Confirmar via `execute_sql` que `people.is_regular = true` e `people.regular_interval_days = 15` para `P1` (a chamada PATCH ligou `is_regular` automaticamente).
3. Recarregar a ficha e confirmar que "Cadência efetiva" agora mostra "a cada 15 dias (definido para este contacto)" — já não mostra a etapa.
4. Apagar (ou datar fora da janela) o `automation_logs` da regra `stage_recurring` criado no Step 3, para poder testar de novo sem deduplicação a mascarar o resultado: `delete from automation_logs where rule_id = '<rule-id-stage_recurring>' and lead_id = '<lead-id>';`
5. Repetir o `curl` do Step 3.
6. Confirmar via `execute_sql` que **não** aparece uma nova linha em `automation_logs` para a regra `stage_recurring` e a lead de `P1` — a supressão funcionou.
7. Confirmar que os outros avisos da etapa continuam ativos: mudar a etapa da lead de `P1` para outra etapa com um aviso "ao entrar" (`stage_changed`) configurado, e confirmar (via `execute_sql` em `automation_logs`, ou pela notificação recebida) que esse aviso dispara normalmente — não é afetado pela supressão.

- [ ] **Step 5: Testar "Contacto sem `is_regular`, sem leads em etapas com aviso recorrente" (mapeia o 1º ponto de "Testes" da spec)**

1. Abrir a ficha de um contacto sem leads ativos em etapas com `stage_recurring`, e sem `regular_interval_days`.
2. Confirmar que "Cadência efetiva" mostra "prazos da agência (padrão: primeiro aviso aos N dias, depois aos M dias)", com N/M a corresponderem aos valores reais de `agencies.followup_first_days`/`followup_second_days` dessa agência (conferir via `execute_sql` ou em `/settings/agency`).

- [ ] **Step 6: Testar "Editar sem `is_regular` ligado liga automaticamente" (mapeia o 4º ponto de "Testes" da spec)**

1. Escolher um contacto `P2` com `is_regular = false` e `regular_interval_days = null`.
2. Na ficha de `P2`, escolher um preset no editor de frequência (ex. 30 dias).
3. Confirmar via `execute_sql`: `select is_regular, regular_interval_days from people where id = '<P2>';` — esperado `is_regular = true`, `regular_interval_days = 30`.
4. Confirmar na UI que o botão "Marcar como regular" passou a "✓ Contacto regular".

- [ ] **Step 7: Testar "Contacto com dois leads ativos em etapas diferentes, sem override próprio" (mapeia o 5º ponto de "Testes" da spec)**

1. Escolher (ou preparar) um contacto `P3` sem `regular_interval_days`, com duas leads ativas em pipelines/etapas diferentes, ambas com regra `stage_recurring` configurada (intervalos diferentes, ex. 10 e 20 dias).
2. Abrir a ficha de `P3` e confirmar que "Cadência efetiva" lista as duas linhas, uma por lead, cada uma com o seu próprio "a cada N dias, definido na etapa" — não um valor agregado único.

- [ ] **Step 8: Limpeza dos dados de teste** — reverter `is_regular`/`regular_interval_days` de `P1`/`P2`/`P3` para o estado anterior aos testes (se estes contactos forem reais e não descartáveis), e apagar quaisquer `automation_logs`/regras `automation_rules` criadas só para o teste.

- [ ] **Step 9: Consola sem erros novos** — confirmar `npx eslint` limpo e a consola do browser sem erros durante os passos 3-7.

- [ ] **Step 10: Revisão final da fatia + commit de eventuais correções encontradas na verificação manual.**

---

## Auto-revisão (feita ao escrever este plano)

- **Cobertura da spec:** "Alterações §1" → Task 1. "Alterações §2" (sempre visível + editor reaproveitado + PATCH liga `is_regular`) → Task 2. "Alterações §3" (supressão + `person_id` no cron sem N+1) → Task 3. Todos os 5 pontos de "Testes" → Task 4, Steps 3-7 (mapeados 1:1, com o ponto central — contacto com override + lead em etapa com `stage_recurring` — a receber o maior detalhe, Step 4). "Prioridade de cálculo" (3 níveis) → refletida literalmente na condicional da Task 2 Step 6 (`person.regular_interval_days != null` → `leadsWithStageCadence.length > 0` → prazos da agência). "Fora de âmbito" (4 pontos) — nenhuma task ultrapassa esses limites: não se toca em `leads.regular_interval_days` para leads sem contacto, não se suprime `stage_changed`/`lead_inactive`/`stage_days_after_entry`, não se agrega o valor quando há vários leads (Task 2 Step 6 lista, não agrega).
- **Placeholders:** nenhum "TBD"/"implementar depois" — todos os steps têm código completo (antes/depois) ou comandos exatos com resultado esperado.
- **Consistência de tipos:** `stage_recurring_days: number | null` no JSON devolvido pela API (Task 1) == `stage_recurring_days?: number | null` em `LeadSummary` (Task 2 Step 1) == uso em `lead.stage_recurring_days` no JSX (Task 2 Step 6) e no filtro `leadsWithStageCadence` (Task 2 Step 5). `person_id` já existe em `Lead`/`leads` (tipo `string | null`, `types/index.ts:159`) — usado sem alteração de tipo em `LeadWithStage`/no cron.
