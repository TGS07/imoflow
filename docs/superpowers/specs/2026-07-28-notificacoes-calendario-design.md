# Sincronização seletiva de notificações com o calendário

**Data:** 2026-07-28
**Status:** Aprovado para planeamento

## Contexto

O ImoFlow já tem um sistema de notificações maduro:
- Cadência de acompanhamento configurável por contacto (`people.regular_interval_days`) e por lead (`leads.regular_interval_days`), calculada em `lib/contacts/followup.ts`.
- Avisos configuráveis por etapa da pipeline (`components/pipeline/StageNotificationsModal.tsx`), guardados como `automation_rules` e avaliados pelo cron `app/api/cron/stage-notifications/route.ts`.
- Notificações de acompanhamento e datas especiais criadas pelo cron `app/api/cron/contact-followup/route.ts`.
- Todas as notificações passam por `createNotification()` (`lib/notifications.ts`), que grava em `notifications` e opcionalmente envia por Telegram/email.
- Um calendário interno de "Atividades" já existe em `/activities` (vistas mês/semana/dia), sobre a tabela `activities`.
- **Não existe** nenhuma integração externa de calendário (Google Calendar, ICS, etc.) no código.

O pedido do utilizador: poder escolher, contacto a contacto (ou lead a lead), que notificações passam também a aparecer no calendário — tanto no calendário interno da app como, opcionalmente, num calendário externo (nomeadamente o Notion Calendar). Nada disto deve ser automático para todos os contactos/leads — é sempre opt-in, item a item.

## Decisão de arquitetura

Reaproveitar a tabela `activities` existente como fonte única de eventos, e gerar um feed ICS dinâmico (não armazenado) a partir dela, protegido por um token privado por utilizador. Isto evita:
- Construir uma integração OAuth com o Google Calendar (o Notion Calendar não expõe API de escrita própria, mas suporta subscrever feeds ICS externos, tal como o Google Calendar, Apple Calendar, etc.).
- Duplicar a lógica de cálculo de cadência já existente nos crons.
- Duplicar a UI de calendário — o feed ICS e a página `/activities` mostram exatamente os mesmos eventos.

Alternativas consideradas e rejeitadas: tabela `calendar_events` dedicada (mais isolamento, mas duplica dados e lógica sem benefício claro); feed calculado ao vivo sem persistência (nunca dessincroniza das regras, mas não aparece em `/activities` e duplica o cálculo de cadência que os crons já fazem).

## Modelo de dados

Nova migração:

```sql
alter table people add column calendar_sync_enabled boolean not null default false;
alter table leads  add column calendar_sync_enabled boolean not null default false;
alter table users  add column calendar_token uuid not null default gen_random_uuid();

alter table activities
  add column source text not null default 'manual' check (source in ('manual', 'notification')),
  add column notification_id uuid references notifications(id) on delete cascade;
```

- `calendar_sync_enabled` em `people`/`leads`: toggles independentes um do outro (um contacto e os leads associados a ele podem ter configurações diferentes).
- `calendar_token`: identificador opaco usado na URL do feed ICS pessoal. Nunca é exposto a outros utilizadores; só o próprio o vê/copia nas suas definições.
- `activities.source`/`notification_id`: distingue atividades manuais (criadas pelo utilizador) de atividades espelhadas automaticamente a partir de uma notificação, e evita duplicação ao re-executar os crons.

Nenhuma coluna existente muda de comportamento; todos os defaults são retrocompatíveis.

## Geração de eventos

Nos dois pontos onde os crons criam notificações — `app/api/cron/contact-followup/route.ts` (acompanhamento regular + datas especiais) e `app/api/cron/stage-notifications/route.ts` (avisos de etapa) — depois de chamar `createNotification()`:

1. Verificar se o contacto/lead alvo tem `calendar_sync_enabled = true`.
2. Se sim, e se ainda não existir uma `activity` com o mesmo `notification_id` (proteção contra reexecução do cron), criar uma `activity`:
   - `due_date` = data em que a notificação dispara.
   - `type` = `'follow_up'` (contacto) ou `'pipeline_stage'` (lead) — reaproveitando tipos que a página `/activities` já sabe representar, ou adicionando um novo tipo se necessário (a confirmar na fase de plano).
   - `source = 'notification'`, `notification_id` = id da notificação recém-criada.
   - Associada à pessoa/lead correspondente pelos campos já existentes na tabela `activities`.

Quem não liga o toggle continua a receber a notificação normalmente (campainha, email, Telegram) — a única diferença é que não aparece no calendário. Ligar o toggle não gera eventos retroativos; só as próximas notificações computadas pelos crons passam a ser espelhadas.

## Feed ICS

Novo endpoint: `GET /api/calendar/[token].ics`

- Sem autenticação de sessão — protegido apenas pelo token na URL (é o padrão habitual para feeds de calendário privados).
- Token inválido/inexistente → 404.
- Query a `activities` com `source = 'notification'` pertencentes ao utilizador dono do token (âmbito exato — próprio utilizador vs. toda a agência — a confirmar na fase de plano, consoante o modelo de permissões já usado noutras rotas).
- Gera `VCALENDAR`/`VEVENT` por atividade (título descritivo, ex. "Acompanhamento: João Silva" ou "Etapa: Apartamento Xisto"; `DTSTART` = `due_date`; link de volta para o registo no ImoFlow na descrição).
- `Content-Type: text/calendar; charset=utf-8`.
- Sem cache agressivo — cada pedido gera o feed a partir do estado atual da BD; clientes de calendário (Notion Calendar, Google Calendar, Apple Calendar) fazem poll periódico (tipicamente 15–60 min), pelo que a carga é desprezável.

## Interface

1. **Contacto** (`components/contacts/ContactDetailPanel.tsx`, secção "Acompanhamento" onde já vive `regular_interval_days`): novo switch "Adicionar notificações deste contacto ao calendário".
2. **Lead/pipeline**: o mesmo tipo de switch no painel de detalhe do lead (localização exata a confirmar na fase de plano).
3. **Link do feed pessoal**: painel novo (em Definições/Perfil do utilizador, ou local equivalente a confirmar na fase de plano) com:
   - A URL completa do feed (`.../api/calendar/<token>.ics`).
   - Botão "Copiar link".
   - Instrução curta de como o usar (colar no Notion Calendar / Google Calendar / Apple Calendar em "Subscrever calendário").
   - Botão para regenerar o token, invalidando o link anterior (caso tenha sido partilhado por engano).
4. **Página `/activities`**: as atividades espelhadas automaticamente ganham uma indicação visual discreta (ex. ícone de sino) para se distinguirem das atividades criadas manualmente.

## Fora de âmbito

- Sincronização bidirecional (editar no Google/Notion Calendar e refletir de volta no ImoFlow).
- OAuth com Google Calendar ou qualquer outro provedor.
- Alterar a lógica de cálculo de cadência existente — esta funcionalidade só espelha o que já seria notificado.
- Configurar a cadência de notificação por contacto a partir desta funcionalidade (é o âmbito de uma spec separada, já identificada: "cadência de notificação por contacto").

## Testes

- Ligar o toggle num contacto/lead e confirmar que a próxima notificação gerada pelo cron cria também uma `activity` com `source = 'notification'`.
- Confirmar que contactos/leads sem o toggle ligado não geram atividades espelhadas.
- Confirmar que reexecutar o cron não duplica atividades para a mesma notificação.
- Aceder ao feed ICS com um token válido e validar que o ICS gerado é sintaticamente válido (parseável) e contém só os eventos esperados.
- Aceder ao feed ICS com um token inválido e confirmar 404.
- Regenerar o token e confirmar que o link antigo deixa de funcionar.
