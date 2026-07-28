# Cadência de notificação efetiva por contacto

**Data:** 2026-07-28
**Status:** Aprovado para planeamento

## Contexto

O ImoFlow tem hoje **três sistemas de cadência de notificação independentes**, que não comunicam entre si:

1. **Contacto** (`people.is_regular` + `people.regular_interval_days`) — editável em `components/contacts/ContactDetailPanel.tsx`, secção "Acompanhamento", mas só visível quando `is_regular` está ligado. Avaliado por `followupStatus()` (`lib/contacts/followup.ts`) no cron `app/api/cron/contact-followup/route.ts`: quando `regular_interval_days` está definido, substitui totalmente os prazos da agência (não há combinação).
2. **Lead solto** (`leads.is_regular` + `leads.regular_interval_days`) — editável em `app/(app)/leads/[id]/page.tsx`, mas o cartão só aparece quando `!lead.people` (quando há contacto associado, a gestão da cadência é feita só na ficha do contacto). Avaliado pelo mesmo cron, como item separado.
3. **Etapa da pipeline** (`automation_rules` com `trigger_type: 'stage_recurring'`, `trigger_config.{stage_id, interval_days}`) — configurado em `components/pipeline/StageNotificationsModal.tsx`, afeta **todos** os leads dessa etapa por igual, sem override por lead. Avaliado pelo cron `app/api/cron/stage-notifications/route.ts` via `lib/automations/engine.ts`.

Um contacto pode ter vários leads ativos, em pipelines/etapas diferentes. Hoje não existe nenhum ponto do código que calcule "a cadência de notificação efetiva deste contacto" combinando os três sistemas — um contacto especial que devia ter um ritmo diferente do resto da equipa não tem onde ver isso nem mudar isso de forma clara, e mesmo definindo `regular_interval_days` no contacto, continuaria a receber também os avisos recorrentes da etapa em paralelo.

## Objetivo

1. Mostrar, sempre, na ficha do contacto, qual é a cadência de notificação que **efetivamente** se aplica a ele — seja ela o valor próprio do contacto, ou o valor herdado da etapa de um dos seus leads ativos.
2. Permitir mudar o valor do contacto a partir desse mesmo local (reaproveitando o editor já existente).
3. Quando o contacto tem um valor próprio definido, esse valor **substitui** o aviso recorrente da etapa para os leads desse contacto — deixa de receber duas notificações com ritmos diferentes.

## Prioridade de cálculo

1. **`people.regular_interval_days`** (se definido) — manda sempre, independentemente de qualquer etapa.
2. Senão, **para cada lead ativo do contacto**, o `interval_days` da regra `stage_recurring` da etapa atual desse lead (se existir) — mostrado por lead, não agregado num único número, porque leads diferentes podem estar em etapas com ritmos diferentes.
3. Senão, **prazos da agência** (`agencies.followup_first_days`/`followup_second_days`) — o comportamento por defeito de sempre.

## Alterações

### 1. API — `GET /api/people/[id]`

Para cada lead ativo devolvido (já inclui `stage_id`/`pipeline_stages`), passa a incluir também `stage_recurring_days: number | null` — o `interval_days` da regra `automation_rules` com `trigger_type='stage_recurring'` e `trigger_config->>stage_id` igual ao `stage_id` desse lead (uma query adicional a `automation_rules`, filtrada pelos `stage_id` dos leads ativos do contacto). Não é criada nenhuma tabela nova nem endpoint novo.

### 2. UI — `ContactDetailPanel.tsx`, secção "Acompanhamento"

O bloco "Follow-ups" deixa de estar escondido atrás do toggle "Marcar como regular" — passa a mostrar sempre a cadência efetiva, calculada pela prioridade acima:

- Se `person.regular_interval_days` definido: "A cada X dias (definido para este contacto)".
- Senão, se houver leads ativos com `stage_recurring_days`: lista curta, uma linha por lead — "«Nome do negócio» (etapa «X»): a cada N dias, definido na etapa".
- Senão: "Prazos da agência (padrão: primeiro aviso aos N dias, depois aos M dias)".

O editor de valor (presets `REGULAR_INTERVAL_PRESETS` + campo "outro (dias)") continua a existir tal como hoje, só deixa de estar condicionado a `is_regular` estar ligado — ao escolher um valor, o pedido PATCH liga `is_regular=true` automaticamente se ainda não estiver.

### 3. Supressão do aviso recorrente da etapa

Em `app/api/cron/stage-notifications/route.ts`, antes de chamar `triggerAutomations` para uma regra `stage_recurring` correspondente a um lead: se esse lead tiver `person_id` associado, e a pessoa correspondente tiver `is_regular=true` e `regular_interval_days` não nulo, esse lead é ignorado **só para essa regra** (`stage_recurring`) — não chama `triggerAutomations`. Os outros três tipos de aviso da etapa (`stage_changed`, `lead_inactive`, `stage_days_after_entry`) continuam a disparar normalmente para esse lead, porque são eventos pontuais, não uma cadência recorrente concorrente com a do contacto.

Isto requer que o cron, ao carregar os leads ativos, traga também `person_id` e, para os que tiverem, uma pequena lookup a `people` (`is_regular`, `regular_interval_days`) — reaproveitando o padrão já usado no cron `contact-followup` para evitar N+1 (uma query única para todos os `person_id` envolvidos, não uma por lead).

## Fora de âmbito

- Unificar os três sistemas numa única tabela/mecanismo — mantém-se a arquitetura atual, só se adiciona a regra de prioridade e a supressão pontual descrita acima.
- Mudar o comportamento de `leads.regular_interval_days` para leads sem contacto associado (`!lead.people`) — continua exatamente como está hoje.
- Suprimir os outros três tipos de aviso da etapa (entrada, parado há X dias, dias após entrada) quando o contacto tem override — só o aviso recorrente é suprimido, por ser o único que representa um "ritmo" comparável ao do contacto.
- Agregar num único número quando o contacto tem vários leads ativos em etapas com ritmos diferentes — mostram-se todos, um por lead.

## Testes

- Contacto sem `is_regular`, sem leads em etapas com aviso recorrente → mostra "Prazos da agência".
- Contacto com um lead ativo numa etapa com `stage_recurring` configurado, sem override próprio → mostra a cadência da etapa, e o cron `stage-notifications` continua a notificar normalmente para esse lead.
- Contacto com `regular_interval_days` definido e um lead ativo numa etapa com `stage_recurring` configurado → a ficha mostra só o valor do contacto; correr o cron `stage-notifications` não dispara o aviso recorrente para esse lead (confirmar via `automation_logs`); os outros avisos da etapa (ex: entrada numa nova etapa) continuam a disparar normalmente.
- Editar o valor a partir da ficha do contacto sem `is_regular` ligado → liga `is_regular` automaticamente e grava o intervalo.
- Contacto com dois leads ativos em etapas diferentes, sem override próprio → ambos aparecem listados, cada um com o seu valor.
