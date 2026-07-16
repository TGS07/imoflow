# Frequência por contacto, contacto especial, associações imóvel↔pessoa e agenda do dia

**Data:** 2026-07-16 · **Estado:** aprovado pelo utilizador (conversa)

## Contexto

O follow-up automático já existe ([2026-07-15-contactos-pipeline-regular-imoveis-design.md](2026-07-15-contactos-pipeline-regular-imoveis-design.md)),
mas usa um único prazo global por agência (`followup_first_days` /
`followup_second_days`) para todos os contactos "regulares". Diferentes
clientes precisam de estratégias diferentes (uns semanal, outros trimestral).
Falta também um mecanismo separado para datas simbólicas (Natal, Páscoa,
aniversário) que não são "inatividade", e a associação imóvel↔pessoa só
existe num sentido (imóvel → vendedor via `seller_id`), sem suportar
partilha entre consultores. Este spec cobre as quatro peças.

## 1. Frequência de follow-up por contacto ("regular")

### Dados
- `people.regular_interval_days int` (nullable). Igual em `leads`.
  - `null` → mantém o comportamento atual (prazos globais da agência:
    `followup_first_days` / `followup_second_days`).
  - preenchido → substitui os dois prazos globais por **um único** intervalo:
    lembrete cada vez que passam `regular_interval_days` dias sem interação.

### UI
- Na ficha do contacto/lead, quando "Contacto regular" está ativo, aparece
  por baixo um seletor de frequência:
  - Atalhos: **5, 7, 15, 30, 60, 90 dias**.
  - Campo livre "outro (dias)" para qualquer valor custom.
  - Se nada for escolhido, mostra "prazos da agência" (o padrão atual) como
    opção explícita — não obriga a escolher.

### Cron `contact-followup`
- Para cada item com `is_regular = true`:
  - Se `regular_interval_days` preenchido: um único nível de lembrete, dispara
    quando `dias sem contacto >= regular_interval_days`, repete a cada
    múltiplo do intervalo (dedup por janela = `regular_interval_days`, mesma
    técnica já usada).
  - Se `null`: mantém a lógica atual de 2 níveis (1º/2º lembrete).

## 2. Contacto especial (datas importantes)

Independente de "regular" — um contacto pode ser as duas coisas, nenhuma, ou
só uma.

### Dados
- `people.is_special boolean not null default false`
- `people.special_dates jsonb not null default '[]'`
  — array de `{ "label": string, "month": int, "day": int }` para datas
  personalizadas (ex.: `{"label": "Aniversário de casamento", "month": 6, "day": 12}`).
  Natal, Páscoa e aniversário **não** entram aqui — são calculados a partir
  de regras fixas + `people.birthday` (já existente), para não haver
  duplicação de dados nem desatualização de ano para ano.

### UI
- Botão irmão do "Contacto regular": **"Marcar como contacto especial"**
  (mesmo padrão visual, cor distinta).
- Ao ativar, mostra checkboxes:
  - ☑ Natal (25/12, fixo)
  - ☑ Páscoa (calculada automaticamente por ano — algoritmo de Computus,
    sem manutenção)
  - ☑ Aniversário (usa `birthday`; se vazio, checkbox fica desativada com
    aviso "preenche a data de nascimento")
  - **"+ Adicionar data personalizada"** → adiciona entradas a
    `special_dates` (label + dia + mês, sem ano).

### Cron (mesmo job `contact-followup`, secção nova)
- Diariamente, para cada `people` com `is_special = true`: verificar se hoje
  bate com Natal / Páscoa (se checkbox ativa) / aniversário (se `birthday`
  preenchido e checkbox ativa) / alguma entrada de `special_dates`.
- Se sim → notificação distinta (tipo `special_date`, não confundir com
  inatividade): "🎂 Hoje é aniversário de {nome}" / "🎄 Natal — contacta
  {nome}" / "{label}: {nome}".
- Sem deduplicação por janela de dias (a data só ocorre uma vez por ano) —
  basta verificar se já não foi enviada hoje (mesma técnica de checar
  `notifications` recentes, janela de 1 dia).

## 3. Associações imóvel ↔ contacto ↔ consultor

### Vendedor ↔ imóvel (bidirecional, reaproveita `seller_id`)
- Já existe `properties.seller_id → people(id)`, mas hoje só se define a
  partir do imóvel. Passa a ser editável dos dois lados:
  - **Ficha do imóvel:** seletor "Vendedor" (já existe/ajustar para garantir
    que está presente e editável).
  - **Ficha do contacto (quando tipo inclui `vendedor`):** secção "Imóveis
    deste vendedor" — lista os imóveis com `seller_id = este contacto` +
    botão "Associar imóvel existente" (procura por título/referência entre
    os imóveis da agência sem exigir que já tenha vendedor).

### Consultor ↔ imóvel (partilha, muitos-para-muitos)
- Nova tabela `property_consultants`:
  ```sql
  create table public.property_consultants (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties(id) on delete cascade,
    person_id uuid not null references public.people(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (property_id, person_id)
  );
  ```
  RLS por `agency_id` seguindo o padrão das outras tabelas (join com
  `properties.agency_id`).
- **Ficha do imóvel:** secção "Consultores / partilha" — adicionar/remover
  contactos do tipo `consultor` associados a este imóvel (permite vários, para
  partilhas entre agências).
- **Ficha do contacto (quando tipo inclui `consultor`):** secção "Imóveis
  associados" — lista os imóveis onde este CI está em `property_consultants`
  + botão "Associar a um imóvel" (procura entre os imóveis da agência).
- Esta tabela é distinta de `seller_id`: um imóvel tem no máximo um vendedor,
  mas pode ter vários consultores associados.

## 4. Agenda de hoje

- Novo bloco **"Hoje"** no dashboard (`/dashboard`), acima ou ao lado dos
  blocos existentes.
- Agrega, calculado em tempo real (sem tabela nova — reaproveita a mesma
  lógica do cron, correndo a pedido no servidor):
  - Contactos/leads regulares cujo prazo de follow-up já foi atingido hoje
    ou antes (mesmos critérios do §1).
  - Contactos especiais com data a ocorrer hoje (mesmos critérios do §2).
- Cada linha mostra nome, motivo ("follow-up atrasado X dias" /
  "🎂 aniversário hoje") e link para a ficha do contacto/lead.
- Não substitui as notificações individuais (sino + email) — é um resumo
  agregado extra, útil para começar o dia. Filtra sempre por
  `assigned_to = utilizador atual` (admin vê o seu próprio, não o de todos).

## Fora do âmbito

- Envio da agenda de hoje por WhatsApp/Telegram (fica para uma fase
  seguinte, depende do bot externo).
- Migração de dados antigos de `followup_first_days`/`followup_second_days`
  para `regular_interval_days` (os dois sistemas coexistem; `null` continua
  a usar os prazos da agência).
- Edição de Natal/Páscoa como datas customizáveis por agência (assume-se
  Portugal, datas fixas/calculadas).

## Testes / verificação

- Preview local: marcar contacto como regular com intervalo custom (ex.: 5
  dias), forjar `last_interaction_at` antigo, correr cron manualmente,
  confirmar notificação e deduplicação.
- Marcar contacto como especial, ativar aniversário com `birthday` = hoje
  (ano diferente), correr cron, confirmar notificação "🎂".
- Associar imóvel a vendedor a partir da ficha do contacto e a partir da
  ficha do imóvel; confirmar que aparece dos dois lados.
- Associar 2 consultores ao mesmo imóvel (partilha); confirmar que aparecem
  na ficha do imóvel e na ficha de cada consultor.
- Verificar bloco "Hoje" no dashboard com pelo menos um contacto regular
  atrasado e um aniversário do dia.
- `npm run build` sem erros de tipos.
