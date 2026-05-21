# Notificações — Design Spec
**Data:** 2026-05-21
**Projecto:** ImoFlow CRM
**Estado:** Aprovado

---

## Resumo

Sistema de notificações in-app + email para agentes imobiliários. Notifica em tempo útil sobre eventos relevantes (nova lead, tarefa com prazo, mudança de etapa, email recebido) sem adicionar infraestrutura nova.

---

## Eventos que geram notificação

| Tipo | Trigger | Destinatário |
|------|---------|--------------|
| `new_lead` | `POST /api/leads` | Agente atribuído à lead |
| `task_due` | Vercel Cron diário (08:00) | Agente responsável pela tarefa (no dia de vencimento) |
| `lead_stage_changed` | `PATCH /api/leads/[id]` | Agente atribuído à lead |
| `email_received` | `POST /api/emails/send` | Agente atribuído à lead |

---

## Arquitectura

### Base de Dados

Tabela `notifications` no Supabase:

```sql
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  agency_id  uuid not null references agencies(id) on delete cascade,
  type       text not null check (type in ('new_lead','task_due','lead_stage_changed','email_received')),
  title      text not null,
  body       text not null,
  link       text,          -- path relativo, ex: /leads/[id]
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index on notifications(user_id, created_at desc);
```

**Retenção:** máximo 20 notificações por utilizador. Ao inserir uma nova, apagam-se as mais antigas se o total ultrapassar 20.

**Opt-out de email:** campo `email_notifications boolean default true` adicionado à tabela `profiles`.

---

## Função interna `createNotification`

```ts
// lib/notifications.ts
createNotification({
  userId: string,
  agencyId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
}): Promise<void>
```

Responsabilidades:
1. Inserir linha em `notifications`
2. Apagar notificações antigas se total > 20
3. Se `profiles.email_notifications === true`, enviar email via Resend

Chamada directamente dentro das API routes existentes para `new_lead`, `lead_stage_changed` e `email_received` — sem fila, sem workers.

Para `task_due`: chamada por um **Vercel Cron Job** (`app/api/cron/task-reminders/route.ts`) agendado para as 08:00 diariamente. O cron consulta todas as tarefas com `due_date = today` e `status != completed` e cria a notificação para o agente responsável.

---

## API Routes

### `GET /api/notifications`
- Retorna as últimas 20 notificações do utilizador autenticado
- Ordenadas por `created_at DESC`
- Resposta inclui `unread_count: number`

```ts
// Resposta
{
  notifications: Notification[],
  unread_count: number
}
```

### `PATCH /api/notifications/[id]/read`
- Marca uma notificação como lida (`read = true`)
- Retorna `200 OK`

### `PATCH /api/notifications/read-all`
- Marca todas as notificações do utilizador como lidas
- Retorna `200 OK`

---

## UI — NotificationBell

Componente adicionado ao header de `app/(app)/layout.tsx`.

**Comportamento:**
- Ícone de sininho com badge vermelho mostrando `unread_count` (oculto se 0)
- Polling a `/api/notifications` a cada **5 minutos** via `setInterval`
- Ao clicar abre dropdown com lista das últimas 20 notificações

**Cada item da lista:**
- Ícone por tipo (lead, tarefa, email, pipeline)
- Título + corpo
- Tempo relativo ("há 3 min", "há 2h")
- Fundo diferenciado para não lidas
- Clique → navega para `notification.link` + marca como lida

**Acções no dropdown:**
- Botão "Marcar todas como lidas" no topo

**Tecnologia:** React state + fetch nativo. Sem novas bibliotecas.

---

## Emails via Resend

Enviados imediatamente na mesma chamada de API que cria a notificação. Verificação de opt-out antes de enviar.

**Template (texto simples):**

```
Assunto: [ImoFlow] {title}

Olá {agent_name},

{body}

Ver detalhes: https://app.imoflow.pt{link}

---
ImoFlow · Para desactivar notificações por email, vai a Definições > Notificações.
```

**Templates por tipo:**

| Tipo | Assunto | Corpo |
|------|---------|-------|
| `new_lead` | Nova lead: {nome} | Atribuída por {actor}. Telefone: {tel} |
| `task_due` | Tarefa com prazo hoje: {título} | A tarefa "{título}" vence hoje. |
| `lead_stage_changed` | Lead {nome} movida para {etapa} | {actor} moveu {nome} de {etapa_anterior} para {etapa}. |
| `email_received` | Email recebido de {nome} | Recebeste um email de {nome da lead}. |

---

## Fora de Âmbito (v2)

- Notificações push browser (PWA)
- Digest diário por email
- Preferências granulares por tipo de evento
- Histórico completo (> 20 notificações)
- Notificações em tempo real (WebSocket / SSE)
