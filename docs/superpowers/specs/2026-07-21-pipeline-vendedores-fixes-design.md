# Pipeline de Vendedores — correções e novas funcionalidades

**Data:** 2026-07-21
**Origem:** feedback do cliente (Diogo, Diogo Feio Real Estate) via mensagens no Telegram, resumido abaixo.

## Contexto

O cliente reportou uma sequência de problemas e pedidos sobre a pipeline de
vendedores do ImoFlow:

1. Configurou o card da pipeline para mostrar "imóvel" como informação
   principal, mas o card continua a mostrar o nome do contacto.
2. As notificações de etapa deviam permitir avisar numa data específica e
   avisar a cada X dias, além das opções já existentes.
3. A pipeline de vendedores só permite adicionar **contactos**, e bloqueia
   repetir a mesma pessoa — mas uma pessoa pode ter mais do que um imóvel, e
   é preciso poder adicioná-los individualmente.
4. É preciso ligar as notificações do ImoFlow ao telemóvel/Telegram.

## Decisões de âmbito (confirmadas com o utilizador)

- O botão **"+ Contactos"** é **substituído** por um botão **"+ Imóveis"** —
  não ficam os dois em paralelo.
- Esta mudança aplica-se a **todas as pipelines**, não só Vendedores.
- Ao adicionar um imóvel a uma pipeline, o utilizador escolhe **imóvel +
  pessoa** no mesmo passo (o formulário pré-preenche a pessoa com
  `seller_id`/`buyer_id` do imóvel quando existir, mas é sempre editável) —
  isto cobre pipelines onde o imóvel ainda não tem comprador/vendedor
  definido (ex. Investidores).
- **"Avisar numa data específica"** = número de dias após a lead entrar na
  etapa atual (regra da etapa, calculada por lead), não uma data de
  calendário fixa escolhida manualmente.
- **"Avisar a cada X dias"** = aviso recorrente, repete indefinidamente
  enquanto a lead permanecer na etapa — diferente do "parado há X dias"
  existente, que dispara uma única vez ao atingir o limiar.
- A integração Telegram cobre **todas as notificações do sistema** (não só
  as novas de etapa), reaproveitando o bot Telegram já usado pelo projeto
  Idealista Bot. Esse bot **só envia** mensagens (lê Gmail → Telegram),
  nunca recebe updates, por isso o ImoFlow pode configurar o seu próprio
  webhook sem conflito.

## A. Correção do card da pipeline

**Causa raiz** (`components/pipeline/KanbanBoard.tsx`, função
`cardFieldValue` + `LeadCard`): quando `card_primary_field = 'property'` mas
a lead não tem `property_id`, `cardFieldValue` devolve `null` e
`primaryText = cardFieldValue(...) ?? lead.name` cai sempre no nome. Isto
não é um bug isolado — é sintoma direto de leads criadas sem imóvel
associado (ver secção B). Uma vez garantido que leads de pipeline com
imóveis têm sempre `property_id`, o card mostra a referência/título do
imóvel corretamente.

**Mudança de código:** nenhuma mudança de lógica é necessária em
`cardFieldValue`/`LeadCard` — o fallback para `lead.name` mantém-se como
proteção para leads que genuinamente não tenham imóvel (ex. lead criada
manualmente sem escolher imóvel). O que resolve o problema relatado é a
secção B.

## B. "+ Imóveis" — adicionar imóveis diretamente à pipeline

### Modelo de dados

Não é preciso alterar o esquema de `leads` — já tem `person_id` e
`property_id`, ambos nullable e independentes. A mudança é só no fluxo de
criação e na regra de duplicados.

**Novo endpoint** `POST /api/pipelines/[id]/add-properties`, paralelo ao
`add-contacts` existente. Body: `{ items: { property_id: string, person_id:
string | null }[] }`. Para cada item:
- Cria uma lead na 1ª etapa da pipeline com `property_id` e `person_id`
  preenchidos, copiando `zone`/`typology`/`price` do imóvel (equivalente ao
  que `add-contacts` já faz a partir de `people.details`).
- `name` da lead usa o nome da pessoa se houver, senão a referência/título
  do imóvel.

**Regra de duplicados:** deixa de bloquear por `person_id` sozinho. Passa a
verificar a combinação `(person_id, property_id)` — permite a mesma pessoa
várias vezes com imóveis diferentes, mas continua a evitar adicionar o
mesmo par duas vezes enquanto a lead estiver ativa (etapa não won/lost).
Isto implica também alterar `alreadyInIds` em `PipelineBoard.tsx` (hoje é um
`Set<person_id>`) para `Set<"${person_id}:${property_id}">`.

O endpoint `add-contacts` existente **é removido** (substituído), assim
como `ContactPickerModal.tsx` e o botão "+ Contactos" em
`PipelineBoard.tsx`.

### UI

Novo `components/pipeline/PropertyPickerModal.tsx`, espelhando a estrutura
de `ContactPickerModal.tsx`:
- Lista imóveis via `GET /api/properties` (pesquisa por referência/título/
  zona), com paginação/scroll igual ao picker de contactos.
- Ao selecionar um imóvel, mostra um segundo campo (autocomplete de
  pessoas, igual ao usado em `NewLeadModal.tsx`) pré-preenchido com
  `seller_id` (ou `buyer_id`, conforme a pipeline — ver abaixo) do imóvel,
  se existir. Pode ficar vazio ou ser trocado.
- Permite selecionar vários imóveis de uma vez (checkboxes, como hoje),
  cada um com o seu campo de pessoa associada.
- Botão "Adicionar" chama `add-properties` com a lista completa.

`PipelineBoard.tsx`: botão "+ Contactos" → "+ Imóveis", abre
`PropertyPickerModal` em vez de `ContactPickerModal`.

**Qual campo pré-preencher (seller_id vs buyer_id):** não há hoje uma forma
fiável de saber automaticamente qual pipeline é "de vendedores" vs "de
compradores/investidores" a partir dos dados (é só um `name` de texto).
Solução simples: o modal tenta `seller_id` primeiro e usa `buyer_id` como
fallback se o vendedor não estiver definido; em qualquer caso o campo é
sempre editável, por isso um pré-preenchimento "errado" nunca bloqueia o
utilizador.

## C. Notificações de etapa — 2 novos tipos de aviso

### Modelo de dados

Estende os `trigger_type` de `automation_rules` (migration nova,
`DROP CONSTRAINT` + `ADD CONSTRAINT`, seguindo o padrão de
`20260611_whatsapp_and_agency_email.sql`):

```sql
ALTER TABLE public.automation_rules DROP CONSTRAINT automation_rules_trigger_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_trigger_type_check
  CHECK (trigger_type IN (
    'stage_changed', 'lead_created', 'activity_completed', 'lead_inactive',
    'whatsapp_message_received', 'stage_days_after_entry', 'stage_recurring'
  ));
```

- `stage_days_after_entry`: `trigger_config = { stage_id, days }` — dispara
  uma vez quando a lead está há `days` dias na etapa (calculado a partir de
  `leads.stage_entered_at`, campo novo — ver abaixo).
- `stage_recurring`: `trigger_config = { stage_id, interval_days }` —
  dispara repetidamente a cada `interval_days` dias enquanto a lead
  continuar na etapa. Dedup por janela de `interval_days` no
  `automation_logs` (igual ao padrão já usado para `lead_inactive`).

**Novo campo `leads.stage_entered_at`** (timestamptz, default `now()`):
necessário para calcular "dias na etapa atual" — hoje não existe nenhum
registo de quando a lead entrou na etapa corrente. Migration:

```sql
ALTER TABLE public.leads ADD COLUMN stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE public.leads SET stage_entered_at = created_at; -- backfill razoável
```

`app/api/leads/[id]/route.ts` (PATCH): quando `stage_id` muda, o update
passa a incluir `stage_entered_at: new Date().toISOString()`.

### Motor de automação

`lib/automations/engine.ts`, `matchesTriggerConfig`: os dois novos
`trigger_type` não dependem de um `AutomationEvent` disparado por uma ação
do utilizador — são avaliados por um **cron novo**
(`app/api/cron/stage-notifications/route.ts`), à semelhança de
`lead-inactive`: itera leads ativas, calcula dias desde
`stage_entered_at`, e chama `triggerAutomations` com
`type: 'stage_days_after_entry'` ou `'stage_recurring'` e
`meta: { daysSinceStageEntry }` quando o limiar é atingido.

`action_type` mantém-se `send_notification` (mesmo padrão dos avisos de
etapa existentes) — não é preciso estender `action_type`.

`vercel.json`: adiciona `stage-notifications` ao cron diário. Aproveito
para também agendar `lead-inactive`, que existe no filesystem mas **não
está agendado hoje** — bug pré-existente detetado durante a investigação,
fora do pedido do cliente mas trivial de corrigir na mesma migration de
cron.

### UI

`StageNotificationsModal.tsx` ganha duas novas linhas, seguindo o padrão
visual das duas existentes:
- Checkbox + input numérico: "Avisar X dias depois de entrar nesta etapa".
- Checkbox + input numérico: "Avisar a cada X dias enquanto estiver nesta
  etapa".

`app/api/pipeline-stages/[id]/notifications/route.ts`: `GET`/`PUT`
estendem `StageNotificationsState` com `days_after_entry: number | null` e
`recurring_days: number | null`, sincronizando regras `stage_days_after_entry`
e `stage_recurring` da mesma forma que já faz para `stage_changed`/
`lead_inactive`.

## D. Integração Telegram

### Modelo de dados

```sql
ALTER TABLE public.users ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE public.users ADD COLUMN telegram_link_code TEXT;
CREATE UNIQUE INDEX users_telegram_chat_id_idx ON public.users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
```

`telegram_link_code`: código curto de uso único gerado quando o utilizador
inicia o processo de ligação (nas Definições), consumido pelo webhook ao
receber `/start <código>`.

### Fluxo de ligação (cada utilizador liga a sua conta)

1. Definições → Notificações: botão "Ligar Telegram" gera um código (ex.
   6 carateres) e mostra `t.me/<bot_username>?start=<código>` (link e/ou
   QR), guardando o código em `users.telegram_link_code`.
2. Utilizador abre o link, o Telegram envia `/start <código>` ao bot.
3. `POST /api/telegram/webhook` (endpoint novo, configurado como webhook do
   bot via `setWebhook` — passo manual único, documentado abaixo) recebe o
   update, procura o `users` com esse `telegram_link_code`, grava
   `telegram_chat_id = update.message.chat.id`, limpa
   `telegram_link_code`, e responde no chat "Conta ImoFlow ligada com
   sucesso." via `sendMessage`.
4. Definições mostra o estado "Telegram ligado ✓" com opção de desligar
   (limpa `telegram_chat_id`).

### Envio

Novo `lib/telegram/send.ts`, espelhando `lib/whatsapp/send.ts`:

```ts
export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  // POST https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage
}
```

Sem necessidade de templates pré-aprovados (diferença chave face ao
WhatsApp Business API — Telegram não exige aprovação de templates fora da
janela de 24h).

### Ligação às notificações existentes

`lib/notifications.ts` (`createNotification`): depois do envio de email
existente, adiciona um passo equivalente — se `users.telegram_chat_id`
estiver definido, envia a mesma notificação (`title` + `body` + link) via
`sendTelegramMessage`, em paralelo ao email (não o substitui). Erros de
envio são apanhados e apenas logados (`console.error`), tal como já
acontece com o email, para não bloquear a criação da notificação em si.

Isto cobre automaticamente as notificações novas de etapa (secção C), que
já passam por `createNotification`, sem precisar de um `action_type`
`send_telegram` dedicado no motor de automação.

### Passos manuais (fora do alcance do código)

- Confirmar `TELEGRAM_BOT_TOKEN` do bot existente (o mesmo do Idealista
  Bot) e adicioná-lo às env vars do Vercel.
- Depois do deploy, chamar uma vez
  `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://app.imoflow.pt/api/telegram/webhook`
  para apontar o bot para o novo endpoint. Vou documentar isto em
  `docs/TELEGRAM_SETUP.md`, espelhando `docs/WHATSAPP_SETUP.md`.

## Nota sobre o AGENTS.md

Este repositório usa uma versão modificada do Next.js
(`AGENTS.md`: "This is NOT the Next.js you know"). `node_modules/` não
está instalado nesta worktree, por isso `node_modules/next/dist/docs/` não
pôde ser consultado durante esta investigação. Antes de implementar
qualquer mudança em `app/api/**/route.ts` (novos endpoints
`add-properties`, `telegram/webhook`, `stage-notifications`) é necessário
correr `npm install` e ler esses docs locais para confirmar convenções
específicas deste fork (assinaturas de handlers, etc.).

## Testes / verificação

- Card da pipeline: criar lead via "+ Imóveis" numa pipeline configurada
  com `card_primary_field = 'property'`, confirmar que mostra a
  referência do imóvel.
- Duplicados: adicionar o mesmo imóvel duas vezes é bloqueado; adicionar a
  mesma pessoa com imóveis diferentes funciona.
- Notificações de etapa: testar os 4 tipos de aviso combinados numa
  mesma etapa, confirmar deduplicação (não notifica repetidamente antes da
  janela).
- Telegram: fluxo de ligação ponta-a-ponta num ambiente com bot de teste;
  confirmar que uma notificação normal (ex. nova lead) chega tanto por
  email como por Telegram quando ambos estão ligados.
