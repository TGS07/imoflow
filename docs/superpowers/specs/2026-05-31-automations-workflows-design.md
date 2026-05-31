# Automações/Workflows — Design Spec

**Date:** 2026-05-31
**Status:** Approved
**Subsystem:** #5

---

## Overview

Sistema de automações com regras pré-definidas que executam ações automaticamente em resposta a eventos no CRM. As regras são configuradas por pipeline/stage e geridas via base de dados com seed data para casos de uso comuns em imobiliárias.

---

## Base de Dados

### Tabela `automation_rules`

```sql
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'stage_changed', 'lead_created', 'activity_completed', 'lead_inactive'
  )),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL CHECK (action_type IN (
    'create_activity', 'send_notification', 'move_stage'
  )),
  action_config JSONB NOT NULL DEFAULT '{}',
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`trigger_config` por tipo:**
- `stage_changed`: `{ "to_stage_id": "<uuid>" }` (opcional — se omitido, qualquer stage)
- `lead_inactive`: `{ "inactive_days": 7 }`
- `lead_created`, `activity_completed`: `{}`

**`action_config` por tipo:**
- `create_activity`: `{ "activity_type": "call"|"email"|"meeting"|"note", "title": "...", "due_days": 2 }`
- `send_notification`: `{ "message": "..." }`
- `move_stage`: `{ "to_stage_id": "<uuid>" }`

### Tabela `automation_logs`

```sql
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  result JSONB
);
```

---

## Engine de Automações

**Localização:** `lib/automations/engine.ts`

### Interface principal

```typescript
type AutomationEvent = {
  type: 'stage_changed' | 'lead_created' | 'activity_completed' | 'lead_inactive'
  leadId: string
  userId: string
  meta?: Record<string, unknown> // ex: { toStageId, pipelineId, activityId }
}

async function triggerAutomations(event: AutomationEvent): Promise<void>
```

### Fluxo de execução

1. Buscar todas as `automation_rules` ativas para o `trigger_type` do evento
2. Filtrar por `pipeline_id` (null = aplica a todos)
3. Filtrar por `trigger_config` (ex: verificar `to_stage_id` para `stage_changed`)
4. Para cada regra correspondente, executar o action handler
5. Registar resultado em `automation_logs`

### Action Handlers

**`createActivityHandler`**
- Cria registo na tabela `activities`
- `due_date` = hoje + `action_config.due_days`
- `assigned_to` = responsável atual do lead

**`sendNotificationHandler`**
- Cria registo na tabela `notifications`
- Usa o utilizador responsável pelo lead como destinatário

**`moveStageHandler`**
- Atualiza `leads.stage_id` para o stage definido em `action_config.to_stage_id`
- Não dispara novo evento para evitar loops

---

## Integração nos Endpoints Existentes

| Endpoint | Evento disparado | Condição |
|----------|-----------------|----------|
| `PATCH /api/leads/[id]` | `stage_changed` | quando `stage_id` muda |
| `POST /api/leads` | `lead_created` | sempre |
| `PATCH /api/activities/[id]` | `activity_completed` | quando `status` muda para `completed` |
| Cron job diário | `lead_inactive` | leads sem atividade há X dias |

O cron job de inatividade corre diariamente, verifica leads com última atividade antes de N dias (conforme configurado nas regras), e dispara o evento para cada lead elegível.

---

## Seed Data — Regras Pré-definidas

As seguintes regras são criadas na migração e ficam ativas por defeito:

| Nome | Trigger | Condição | Ação |
|------|---------|----------|------|
| Primeiro contacto | `lead_created` | qualquer | Criar atividade "Primeiro contacto" (call, due: +1d) |
| Preparar proposta | `stage_changed` | stage "Proposta" | Criar atividade "Enviar proposta" (email, due: +2d) |
| Agendar visita | `stage_changed` | stage "Visita" | Criar atividade "Agendar visita ao imóvel" (meeting, due: +3d) |
| Follow-up pós-atividade | `activity_completed` | qualquer | Criar atividade "Follow-up" (call, due: +2d) |
| Alerta de inatividade | `lead_inactive` | 7 dias | Enviar notificação "Lead inativo há 7 dias" |
| Mover para Frio | `lead_inactive` | 14 dias | Mover lead para stage "Frio" (se existir) |

As regras de `stage_changed` que referenciam stages específicos usam `trigger_config.to_stage_id` com o ID do stage correspondente. Se o stage não existir no pipeline, a regra não é executada.

---

## UI de Gestão

**Rota:** `/settings/automations`

- Lista todas as regras com nome, trigger, ação e toggle on/off
- Clique numa regra expande os logs das últimas 20 execuções (triggered_at, lead, status, resultado)
- Sem criação/edição de regras na UI nesta fase

---

## Anti-loops

Para prevenir execuções recursivas:
- `moveStageHandler` não dispara novo `triggerAutomations`
- `createActivityHandler` não dispara `activity_completed`
- Cada lead só pode ter uma regra específica executada uma vez por hora (deduplicação por `rule_id + lead_id + hora`)

---

## Out of Scope

- Builder visual de automações (futuro)
- Webhooks externos
- Automações baseadas em campos personalizados
- Múltiplas ações por regra
