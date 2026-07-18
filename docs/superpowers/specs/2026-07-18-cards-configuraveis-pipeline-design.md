# Cards de pipeline configuráveis (info principal/secundária)

**Data:** 2026-07-18 · **Estado:** aprovado pelo utilizador (conversa)

## Contexto

Pedido do cliente: na pipeline de Vendedores interessa mais a zona/imóvel do
que o nome ("se forem muitos é difícil lembrar sempre pelo nome"); nas outras
o nome é que deve estar em primeiro plano. Deve dar para configurar, por
pipeline, qual a informação que aparece em grande no card e qual aparece em
pequeno — tanto ao editar como ao criar uma pipeline.

Estado atual: `LeadCard` (em `components/pipeline/KanbanBoard.tsx`) tem
layout fixo — nome em grande, depois contacto/imóvel/tipologia·zona/valor.
Criar/renomear pipelines usa `prompt()` em `PipelineBoard.tsx` (botões
"+ Pipeline" e ✏️ da fatia anterior).

Decisões da conversa:
- Campos escolhíveis: **Nome · Zona · Imóvel · Tipologia · Valor** (sem
  opção combinada).
- Configuração num **mini-modal no board** que substitui os `prompt()` de
  criar e renomear.

Branch: continuar em cima de `claude/pesquisa-zona-investidor` (empilhado
sobre PR #10/#11) ou novo branch empilhado — decidir no plano.

## 1. Dados

Migração `supabase/migrations/20260718_pipeline_card_fields.sql`:

```sql
alter table public.pipelines
  add column card_primary_field   text not null default 'name'
    check (card_primary_field in ('name','zone','property','typology','value')),
  add column card_secondary_field text not null default 'zone'
    check (card_secondary_field in ('name','zone','property','typology','value'));

-- Vendedores: o pedido original — zona em grande, nome em pequeno
update public.pipelines
  set card_primary_field = 'zone', card_secondary_field = 'name'
  where name = 'Vendedores';
```

Tipo `Pipeline` em `types/index.ts` ganha os dois campos
(`card_primary_field: PipelineCardField`, idem secondary), com
`export type PipelineCardField = 'name' | 'zone' | 'property' | 'typology' | 'value'`.

## 2. APIs

- `POST /api/pipelines`: aceita `card_primary_field`/`card_secondary_field`
  opcionais (validados contra os 5 valores; defaults da BD se ausentes).
- `PATCH /api/pipelines/[id]`: idem, atualizáveis em conjunto com `name`.
- `GET /api/pipelines` já devolve `*` — os campos novos vêm de graça.

## 3. Mini-modal `PipelineSettingsModal`

Novo `components/pipeline/PipelineSettingsModal.tsx`:
- Campos: Nome (input), "Info principal do card" (select), "Info secundária"
  (select). Rótulos PT: Nome, Zona, Imóvel, Tipologia, Valor.
- O select da secundária exclui o valor escolhido na principal (nunca podem
  ser iguais; se o utilizador mudar a principal para o valor da secundária,
  a secundária salta para o primeiro valor livre).
- Usado por `PipelineBoard.tsx` em dois modos:
  - **Criar**: botão "+ Pipeline" abre o modal vazio (defaults name/zone);
    submete `POST /api/pipelines`.
  - **Editar**: botão ✏️ abre pré-preenchido com a pipeline ativa; submete
    `PATCH /api/pipelines/[id]`.
- Os `prompt()` de criar/renomear são removidos (o 🗑️ com `confirm()`
  mantém-se).
- Estilo: mesmo padrão dos modais existentes (`.modal-backdrop`, `card`,
  `btn`), pequeno (~380px).

## 4. Render do card

- `PipelineBoard` passa a config da pipeline selecionada ao `KanbanBoard`
  (prop `cardFields: { primary: PipelineCardField; secondary: PipelineCardField }`),
  que a passa ao `LeadCard`.
- Resolução de valores por campo, num helper puro no próprio KanbanBoard:
  - `name` → `lead.name`
  - `zone` → `lead.zone`
  - `property` → `lead.properties?.reference ?? lead.properties?.title`
  - `typology` → `lead.typology`
  - `value` → `deal_value ?? budget` formatado `K€`
- **Linha grande** (posição atual do nome): valor do campo principal;
  fallback para `lead.name` quando vazio nesse lead. Avatar mantém sempre
  as iniciais de `lead.name`.
- **Linha pequena** imediatamente abaixo: valor do campo secundário (omitida
  se vazio).
- **Dedupe**: as linhas fixas atuais saltam campos já promovidos —
  a linha 🏠 imóvel não aparece se `property` for principal/secundária; a
  linha tipologia·zona omite a parte promovida; o valor no rodapé não
  aparece se `value` for principal/secundária. Linha do contacto
  (`lead.people.name`) só aparece se diferente do que já está no card
  (regra atual mantém-se). Chip de tipo, data de fecho e drag intactos.

## Fora do âmbito

- Campos personalizados (custom_fields) como opção de destaque.
- Configuração por etapa (só por pipeline).
- Restantes pedidos: notificações por etapa, imóvel↔comprador (specs
  seguintes).

## Testes / verificação

- `npx tsc --noEmit` e `npm run build`.
- Migração aplicada ao Supabase (mcp `apply_migration`) antes do preview.
- Preview: Vendedores mostra zona em grande e nome em pequeno (seed da
  migração); criar pipeline nova com principal=Imóvel; editar config pelo ✏️
  e ver o board mudar; lead sem zona numa pipeline zone-primária cai no
  fallback do nome; sem duplicação de linhas no card.
