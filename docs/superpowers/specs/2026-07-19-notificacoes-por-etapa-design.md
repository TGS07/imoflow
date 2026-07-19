# Notificações por etapa de pipeline

**Data:** 2026-07-19 · **Estado:** aprovado pelo utilizador (conversa; autorizou avançar até ao fim sem gates intermédios)

## Contexto

Pedido do cliente: consoante o estado (etapa) em que um contacto está numa
certa pipeline, configurar notificações para os consultores — por etapa, ao
editar ou criar pipelines/etapas.

O motor de automações existente (`lib/automations/engine.ts` +
`automation_rules`) já cobre quase tudo: trigger `stage_changed` com
`trigger_config.to_stage_id` (aviso ao entrar numa etapa), trigger
`lead_inactive` com `inactive_days` alimentado pelo cron diário
`app/api/cron/lead-inactive` (aviso de leads paradas), ação
`send_notification` (in-app + email por opt-in, destinatário = responsável
da lead com fallback), deduplicação por janela e logs. O que falta:

1. `lead_inactive` não filtra por etapa — o lembrete "parado há X dias"
   dispara para a lead em qualquer etapa.
2. Não há UI por etapa — configurar isto hoje exige montar regras à mão em
   Definições → Automações.

Decisões da conversa:
- Dois tipos de aviso por etapa: **ao entrar** e **parado há X dias**.
- Destinatário: **o responsável do contacto** (comportamento atual do motor).
- Reutilizar o motor de automações (não criar tabela/cron novos).

Sem migrações de BD.

## 1. Motor: filtro de etapa no `lead_inactive`

Em `lib/automations/engine.ts`, no `triggerAutomations`, depois de a lead
ser carregada: filtrar `matchingRules` descartando regras `lead_inactive`
cujo `trigger_config.stage_id` exista e não seja igual a `lead.stage_id`.
Regras sem `stage_id` mantêm o comportamento atual (qualquer etapa).
O tipo `AutomationEvent`/configs não muda (o filtro usa a lead, não o meta).

## 2. API por etapa

Nova rota `app/api/pipeline-stages/[id]/notifications/route.ts`:

- **GET** → estado atual da etapa:
  `{ on_enter: boolean; stale_days: number | null }`, derivado das regras
  em `automation_rules` desta agência com:
  - entrada: `trigger_type='stage_changed'` e
    `trigger_config->>to_stage_id = {id}` e `is_active=true`;
  - parado: `trigger_type='lead_inactive'` e
    `trigger_config->>stage_id = {id}` e `is_active=true`
    (devolve `inactive_days`).
- **PUT** `{ on_enter: boolean; stale_days: number | null }` → sincroniza:
  - Cria a regra em falta, atualiza `inactive_days` se mudou, e **apaga** a
    regra quando o toggle é desligado (apagar, não desativar — o editor por
    etapa é o dono destas regras; `automation_logs.rule_id` tem
    `on delete cascade`? verificar na migração `20260531_automations.sql`;
    se não tiver cascade, desativar (`is_active=false`) em vez de apagar).
  - Nomes legíveis: `Etapa {nome}: aviso de entrada` /
    `Etapa {nome}: parado {X} dias`.
  - Campos das regras: `pipeline_id` da etapa;
    entrada → `trigger_config: { to_stage_id }`;
    parado → `trigger_config: { stage_id, inactive_days }`;
    ambas → `action_type: 'send_notification'`, `action_config` com
    título/mensagem em PT com o nome da etapa (ex.: título
    `Contacto entrou em "{etapa}"` / `Contacto parado em "{etapa}"`,
    mensagem com o nome da lead injetado pelo motor conforme o formato que
    o `executeAction` de `send_notification` espera — verificar
    `action_config` usado pelas regras existentes e imitar).
  - Validação: etapa pertence à agência do utilizador; `stale_days` inteiro
    ≥ 1 quando presente.

## 3. UI: 🔔 por etapa em Definições → Pipeline

Em `app/(app)/settings/pipeline/page.tsx` (página que já lista/edita as
etapas da pipeline selecionada): cada linha de etapa ganha um botão 🔔 que
abre um mini-editor (modal pequeno, padrão `.modal-backdrop`/`.modal`):

- ☑ Avisar quando um contacto entra nesta etapa
- ☑ Avisar quando um contacto está parado há `[X]` dias nesta etapa
  (input numérico ativo só com o toggle ligado)
- Guardar → PUT à rota nova; badge/estado no botão 🔔 quando a etapa tem
  avisos ativos (ex.: 🔔 dourado vs. cinzento).

Como as regras vivem em `automation_rules`, aparecem também em
Definições → Automações (transparência; editá-las lá é possível mas o
editor por etapa sobrepõe ao guardar).

## Fora do âmbito

- Destinatários personalizados por etapa (fica o responsável, com fallback
  do motor).
- Ações de email/WhatsApp nestas regras (a notificação in-app já envia
  email a utilizadores com opt-in).
- Tempo-na-etapa em rigor (usa-se inatividade — sem atividades — que é o
  que o cron `lead-inactive` já mede; rastrear a entrada na etapa exigiria
  colunas novas).
- Imóvel↔comprador (spec seguinte).

## Testes / verificação

- `npx tsc --noEmit` e `npm run build`.
- Preview: ativar 🔔 numa etapa (entrada + parado 7d); confirmar as duas
  regras em Definições → Automações com os nomes esperados; GET devolve o
  estado; desligar um toggle remove/desativa a regra certa.
- Mover um lead para a etapa com aviso de entrada → notificação criada
  (verificável no sino/tabela `notifications`); atenção: em dados reais,
  usar uma etapa/lead de teste e reverter.
- Filtro de etapa do `lead_inactive`: verificação por leitura de código +
  invocação manual do cron é opcional (dados reais); no mínimo, tsc + revisão.
