# Contactos: pipeline, regular/follow-ups, atribuição, nascimento + formulário de imóveis completo

**Data:** 2026-07-15 · **Estado:** aprovado pelo utilizador (conversa)

## Contexto

O cliente (agência SATUS3) quer: observar certos contactos de perto no pipeline;
follow-ups automáticos só para contactos marcados como "regulares" (substituindo
o conceito quente/morno/frio); e o formulário de criação de imóvel tem menos
campos do que a edição (bug percebido).

## 1. Contacto ↔ Pipeline

- **Botão "+ Pipeline"** no cabeçalho da página do contacto (`/people/[id]`) e
  ação equivalente na lista de contactos.
- Ao clicar: cria uma **lead** na 1ª etapa do pipeline da agência (menor
  `position`), com `name`/`email`/`phone` copiados do contacto e
  `person_id` a apontar para ele. `assigned_to` da lead = `assigned_to` do
  contacto.
- **Lead "ativa"** = lead com `person_id` = este contacto cuja etapa não é
  `is_won` nem `is_lost`. Uma lead fechada/perdida antiga não impede voltar a
  adicionar o contacto ao pipeline.
- Se o contacto já tiver uma lead ativa: em vez do botão, mostra **"No pipeline · {etapa}"** (link para
  `/pipeline`) e ação **"Remover do pipeline"** que apaga essa lead. O
  contacto, interações e preferências ficam intactos.
- Cuidado com o trigger `leads_ensure_contact`: ao criar a lead com
  `person_id` já preenchido, o trigger não deve criar um contacto duplicado
  (verificar comportamento atual; ajustar trigger se necessário).

## 2. "Regular" + follow-ups automáticos (substitui quente/frio)

### Dados
- `people.is_regular boolean not null default false`
- `leads.is_regular boolean not null default false`
- `people.assigned_to uuid references users(id)` (leads já têm)
- `people.birthday date` (opcional; ver §4)
- `agencies.followup_first_days int not null default 7`
- `agencies.followup_second_days int not null default 30`
- Backfill: `people.assigned_to` = admin da agência (SATUS3 → Afonso).

### UI
- Toggle **"Contacto regular"** no detalhe do contacto e da lead (e opção no
  modal de criação de ambos). Texto auxiliar: "com follow-ups automáticos".
- **Atribuição de agente:** seletor "Responsável" no detalhe do contacto e da
  lead; **obrigatório** no modal de criação de contacto (pré-selecionado com o
  utilizador atual). Leads mantêm o campo existente, mas ganham o seletor
  visível no detalhe se ainda não tiverem.
- **Definições da agência** (`/settings/agency`): dois campos numéricos —
  "1º lembrete após X dias sem contacto" e "2º lembrete após Y dias".
- **Remover temperatura (quente/morno/frio) da UI de contactos:** filtros
  (`ContactFilters`), modal de criação, página de detalhe. A coluna/chave
  `details.temperature` fica na BD mas deixa de ser mostrada/escrita. Remover
  também dos prompts de IA (extração por voz e sugestões) — a IA deixa de
  preencher `temperature`.

### Cron `contact-followup` (novo, diário)
- Percorre `people` e `leads` com `is_regular = true`.
- Referência de inatividade: `last_interaction_at` (people) / última
  atividade (leads); fallback `created_at`.
- Se dias sem contacto ≥ X → notificação "1º lembrete"; se ≥ Y → "2º
  lembrete" (mais forte). Destinatário: `assigned_to` (fallback: admin da
  agência).
- **Deduplicação:** cada lembrete dispara uma vez por período de silêncio.
  Guardar em `notifications` (ou verificar notificação recente do mesmo tipo
  + link dentro do período) — mesma técnica do `seller-inactive`, mas com
  janela = X (ou Y) dias. Quando há novo contacto registado, o ciclo recomeça.
- Registar em `vercel.json` como cron diário, protegido por `CRON_SECRET`.

## 3. Formulário de criação de imóvel completo

O modal "Novo Imóvel" (`/properties`) passa a ter os mesmos campos da página
de edição, organizado em secções:
- **Essencial:** título*, tipo, estado (disponível/reservado/vendido/
  arrendado), tipologia, preço, área, quartos, casas de banho.
- **Localização:** zona, morada, cidade, código postal, andar.
- **Detalhes:** condição (novo/usado/renovado/em construção), referência,
  descrição, características (vírgulas → array `features`), notas.
- **Fotos (opcional):** URLs, uma por linha (igual à edição — não existe
  upload de ficheiros no sistema atual).
O POST `/api/properties` já deve aceitar estes campos; acrescentar os que
faltarem.

## 4. Data de nascimento

- `people.birthday date` opcional; campo no modal de criação e no detalhe
  do contacto (editável). Mostrar idade calculada ao lado quando preenchido.
- Incluído na extração por voz (§5) e, futuramente, o contacts-sync-bot pode
  mapear o campo BDAY do vCard do iPhone (fora do âmbito deste spec).

## 5. IA dos áudios (transcrição de contacto)

Atualizar `buildContactExtractionPrompt` (e schema correspondente em
`transcribe-entity`):
- **Adicionar:** `"birthday": "YYYY-MM-DD"|null` (converter datas ditas em
  português), `"is_regular": boolean|null` (só se o agente disser
  explicitamente que é um contacto para acompanhar regularmente).
- **Remover:** `details.temperature` do schema e instruções.
- Os handlers que gravam o resultado passam estes campos para a BD.

## Fora do âmbito

- Upload de ficheiros de fotos (mantém-se URLs).
- Migração/limpeza dos valores antigos de `temperature` na BD.
- Mudanças no contacts-sync-bot (BDAY do vCard fica para depois).

## Testes / verificação

- Preview local: criar contacto (agente obrigatório, nascimento opcional),
  marcar regular, adicionar/remover do pipeline, criar imóvel com todos os
  campos.
- Cron: invocar `contact-followup` manualmente com datas forjadas e verificar
  notificações + deduplicação.
- `npm run build` sem erros de tipos.
