# Contacto unificado (Pipeline ↔ Contactos) + gestão de pipelines

**Data:** 2026-07-17 · **Estado:** aprovado pelo utilizador (conversa)

## Contexto

Este é o primeiro de vários pedidos do cliente que tocam subsistemas diferentes
(ver lista completa na conversa de origem). Os outros — cards de pipeline
configuráveis, pesquisa por zona, "o que oferece" do investidor, notificações
por etapa, imóvel↔comprador — ficam para specs seguintes.

Problema atual, confirmado no código:
- `components/pipeline/KanbanBoard.tsx:18` — clicar num card faz sempre
  `router.push('/leads/{id}')`, uma página *lead-cêntrica*, diferente da
  página `/people/[id]` (o verdadeiro editor de contacto: tipos, follow-ups,
  imóveis associados, etc.).
- `app/api/people/[id]/pipeline/route.ts` (POST) — ao clicar "+ Pipeline" na
  página de Contactos, escolhe a etapa de posição mais baixa **em toda a
  agência**, ignorando que há várias pipelines; não deixa escolher a qual.
- `is_regular` / `regular_interval_days` / `assigned_to` existem tanto em
  `leads` como em `people`, geridos em páginas separadas — o toggle "Regular"
  em `/leads/[id]` mexe no lead, não no contacto, daí a confusão.
- `PipelineBoard.tsx` não tem UI para renomear/eliminar pipelines, apesar de
  a API (`/api/pipelines/[id]` PATCH/DELETE) já suportar ambos.
- `LeadCard` não mostra o tipo do contacto (comprador/vendedor/investidor),
  parece sempre um "lead genérico".

Decisões já tomadas na conversa:
- Um contacto pode estar ativo em **várias pipelines em simultâneo** (ex:
  vendedor da casa atual e comprador de outra, ao mesmo tempo).
- Clicar num card abre um **painel lateral (slide-over)** sobre o board, não
  navega para outra página.
- Follow-ups e responsável passam a ser **só do contacto**, não da lead.

Não é preciso nenhuma tabela nova — `leads.pipeline_id` já existe desde o
multi-pipeline (spec `2026-07-15-multi-pipeline-design.md`).

## 1. Painel lateral do contacto (slide-over)

Extrair o conteúdo de `app/(app)/people/[id]/page.tsx` (hero, cartões de
Contacto/Classificação/Acompanhamento/Detalhes/Notas, colunas de IA/interações
/negócios/imóveis) para um componente partilhado:

```
components/contacts/ContactDetailPanel.tsx
  props: { personId: string; embedded?: boolean; onClose?: () => void;
           highlightLeadId?: string; onChanged?: () => void }
```

- `embedded=false` (defeito): usado por `/people/[id]/page.tsx`, que passa a
  ser só o wrapper com breadcrumb/header sticky e o `ContactDetailPanel` por
  baixo.
- `embedded=true`: usado pelo novo `components/pipeline/ContactSlideOver.tsx`
  — painel fixo à direita (largura ~480px, `position: fixed`, overlay
  semitransparente atrás, fecha com `onClose` ou Esc/clique fora). Sem
  breadcrumb; cabeçalho reduzido com nome + botão fechar (×).
- `highlightLeadId`: quando vindo de um card específico, a secção "Negócios
  ativos" (ver §2) faz scroll/realça essa linha.

`KanbanBoard.tsx` deixa de fazer `router.push`; `onClick` no `LeadCard` chama
um callback `onOpenContact(lead.person_id ?? null, lead.id)` subido via props
até `PipelineBoard.tsx`, que guarda `{ personId, leadId }` em estado e
renderiza o `ContactSlideOver`. Leads sem `person_id` (raro — lead nunca
ligada a um contacto) continuam a abrir `/leads/{id}` diretamente, com um
aviso opcional para ligar um contacto.

## 2. "Negócios ativos" substitui o badge único

Em `ContactDetailPanel`, a secção que hoje mostra um único
"No pipeline · {etapa}" (via `.find()` na lista de leads) passa a listar
**todas** as leads ativas do contacto, uma por pipeline:

```
Negócios ativos
┌─────────────────────────────────────────┐
│ Vendedores · Em promoção ▾   120K€       │
│ Ver negócio completo →                   │
├─────────────────────────────────────────┤
│ Compradores · Visitas ▾                  │
│ Ver negócio completo →                   │
└─────────────────────────────────────────┘
+ Adicionar a outra pipeline
```

- O `▾` é um seletor de etapa inline (mesmas etapas da pipeline daquela lead,
  via `pipeline_stages?pipeline_id=`), que faz PATCH direto a
  `/api/leads/{id}` — permite mover a fase sem sair do painel.
- "Ver negócio completo →" abre `/leads/{id}` (página cheia, mantém-se —
  continua a ser onde vivem atividades e a sugestão de IA específicas do
  negócio).
- "+ Adicionar a outra pipeline" abre um pequeno menu com as pipelines onde o
  contacto **não** tem lead ativa (ver §3).
- GET `/api/people/[id]` precisa de trazer `pipeline_id` e o nome da pipeline
  no join de `leads` (hoje só traz `pipeline_stages(...)`); acrescentar
  `pipelines(name)` ao select.

## 3. "+ Pipeline" passa a perguntar qual

- `POST /api/people/[id]/pipeline` passa a aceitar `{ pipeline_id }` no
  corpo. Deixa de escolher a etapa de posição mais baixa da agência; escolhe
  a 1ª etapa **dessa pipeline** (`pipeline_stages` filtrado por
  `pipeline_id`, `order by position`). O bloqueio de "já existe lead ativa"
  passa a verificar apenas dentro da mesma pipeline (`leads.pipeline_id`),
  não globalmente.
- `DELETE /api/people/[id]/pipeline` passa a aceitar `?pipeline_id=` (ou
  `?lead_id=`) e remove só essa lead ativa, não todas.
- UI: botão "+ Pipeline" no `ContactDetailPanel` e na página de Contactos
  abre um menu simples (lista de pipelines em falta); ao escolher, chama a
  API com o `pipeline_id`.

## 4. Follow-ups/responsável só no contacto

- `app/(app)/leads/[id]/page.tsx`: remover o botão "Regular" e o seletor
  "Responsável" do cabeçalho — passam a aparecer só no `ContactDetailPanel`.
  Quando a lead tem `person_id`, a página de lead mostra (só leitura) "Contacto
  regular: sim/não" e "Responsável: {nome}" vindos do contacto, com link para
  abrir o painel.
- Quando a lead **não** tem `person_id` (contacto nunca ligado), os campos
  `leads.is_regular`/`regular_interval_days`/`assigned_to` continuam a ser
  editáveis ali mesmo — fallback necessário, já que não há contacto para
  guardar essa informação.
- Não há migração de dados: as colunas ficam na tabela `leads`, só deixam de
  ser a fonte de verdade quando existe contacto associado.

## 5. Editar/eliminar pipelines

Em `components/pipeline/PipelineBoard.tsx`, junto a cada aba de pipeline
(só quando `isAdmin`): ícones ✏️ (renomear) e 🗑️ (eliminar), visíveis em
hover ou sempre em tamanho reduzido.
- ✏️ → `prompt()` com o nome atual (consistente com `createPipeline()` já
  existente), `PATCH /api/pipelines/{id}`.
- 🗑️ → `confirm()`; antes de abrir o confirm, verifica quantas leads existem
  nessa pipeline (`GET /api/leads?pipeline_id=` ou contagem dedicada). Se > 0,
  mensagem clara: "Esta pipeline tem N contactos — move-os ou remove-os
  primeiro." em vez de deixar a API falhar no erro de FK do Postgres
  (`leads.stage_id` não tem `on delete cascade`). Implementar essa contagem
  no próprio `DELETE /api/pipelines/[id]` (verificação server-side antes do
  delete), devolvendo `400` com mensagem amigável — não só no cliente.
- Mantém-se a regra já existente: não deixar eliminar a última pipeline da
  agência.

## 6. Card do Kanban mostra o tipo de contacto

Em `LeadCard` (`KanbanBoard.tsx`), quando `lead.people?.types` vier
preenchido (precisa de vir no select de `GET /api/leads`), mostrar um ponto
colorido + label pequena com o primeiro tipo relevante (cores de
`CONTACT_TYPES` em `lib/contacts/constants.ts`), ao lado do nome. Não altera
layout do resto do card.

## Fora do âmbito

- Cards de pipeline com informação principal/secundária configurável (spec
  seguinte).
- Pesquisa global por zona, campo "o que oferece" do investidor,
  notificações por etapa, imóvel↔comprador (specs seguintes).
- Reescrever `/leads/[id]` — mantém-se como página de negócio (atividades,
  IA), só deixa de ser o destino do clique no card e perde os campos que
  passam a viver só no contacto.

## Testes / verificação

- `tsc --noEmit`.
- Preview: clicar num card abre o slide-over com os mesmos dados/edição da
  página de Contactos; editar e ver refletido nos dois sítios; adicionar o
  mesmo contacto a 2 pipelines em simultâneo (verificar 2 linhas em "Negócios
  ativos"); remover de uma sem afetar a outra; mudar etapa pelo seletor
  inline; renomear pipeline; tentar eliminar pipeline com leads (erro claro)
  e sem leads (sucesso); confirmar que leads sem contacto continuam a editar
  Regular/Responsável na própria página.
