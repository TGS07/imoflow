# Pré-visualização de card em hover + dias na fase

Data: 2026-07-27

## Problema

Os cards do Kanban da pipeline mostram a info principal/secundária configurada por pipeline, mas com texto limitado (mesmo depois de aumentar os cards e permitir 2 linhas, títulos muito longos continuam a cortar). Também não há forma de ver rapidamente há quanto tempo um card está parado na etapa atual — informação útil para saber que negócios precisam de atenção.

## Solução

### 1. Pré-visualização ampliada em hover

Ao pousar o rato sobre um card do Kanban (sem clicar) durante ~450ms, mostra uma versão ampliada desse card centrada no ecrã, com o resto da página esbatido (blur + escurecido), semelhante visualmente aos modais já existentes (`.modal-backdrop`), mas acionada por hover em vez de clique.

**Trigger e fecho:**
- `onMouseEnter` no card arranca um temporizador de 450ms; se o rato ainda estiver sobre o card quando o temporizador disparar, mostra o preview.
- `onMouseLeave` do card (antes do temporizador disparar, ou enquanto o preview está aberto) cancela/fecha imediatamente.
- Enquanto qualquer card estiver a ser arrastado (`activeId` do `KanbanBoard` não nulo), o hover-preview fica desativado — não arranca temporizador nem mostra overlay, para não interferir com o drag-and-drop.
- Sem tratamento especial para ecrãs táteis: como não existe evento de hover persistente em touch, a funcionalidade simplesmente não é acionada em telemóvel/tablet — o comportamento atual do card mantém-se inalterado nesses dispositivos.

**Conteúdo do preview:**
- Avatar/iniciais e badges de tipo de contacto (`ContactTypeChips`), tal como no card normal.
- Info principal e secundária configuradas na pipeline (`card_primary_field`/`card_secondary_field`), em texto completo, sem `line-clamp` nem `ellipsis`.
- Nome do contacto, apenas se não coincidir já com a info principal ou secundária mostrada.
- Telefone e email do contacto (quando existirem).
- "X dias nesta fase" em destaque, calculado a partir de `leads.stage_entered_at` (ver secção 2).
- **Não inclui** os ícones ⧉ (duplicar) e 🏠 (trocar imóvel) — essas ações continuam a fazer-se apenas no card normal do Kanban.
- É clicável: clicar em qualquer ponto do preview dispara a mesma ação do clique no card normal (abre o painel de contacto ou navega para `/leads/[id]`).

### 2. "Dias nesta fase"

- `leads.stage_entered_at` já existe na base de dados (`supabase/migrations/20260721225247_stage_notification_triggers.sql`) e já é reposto automaticamente para `now()` sempre que `stage_id` muda, por um trigger já existente (`20260721230836_leads_stage_entered_at_trigger.sql` / `20260721231600_leads_stage_entered_at_trigger_when.sql`). Não é preciso nenhuma migração nova.
- `GET /api/leads` já faz `select('*', ...)`, por isso `stage_entered_at` já vem em cada lead sem alterações ao backend.
- Só falta: adicionar `stage_entered_at: string` ao tipo `Lead` (`types/index.ts`), e calcular `dias = floor((agora - stage_entered_at) / 86400000)` no cliente.
- Mostrado em dois sítios:
  - **Card normal do Kanban**: um pill discreto (ex: "5d") sempre visível, num canto do card.
  - **Preview em hover**: texto completo em destaque (ex: "5 dias nesta fase").

## Fora de âmbito

- Nenhuma migração de base de dados.
- Sem suporte dedicado para touch/mobile (a funcionalidade simplesmente não ativa nesses dispositivos).
- Duplicar card e trocar imóvel do card continuam a ser feitos apenas no card normal, não no preview.

## Testes a cobrir

- Hover num card durante <450ms e sair antes do fim do atraso não mostra o preview.
- Hover ≥450ms mostra o preview centrado, com o texto completo (não cortado) da info principal/secundária.
- Iniciar um drag (deste ou de outro card) enquanto o preview está aberto fecha-o e impede que volte a abrir durante o drag.
- Clicar no preview abre o mesmo destino que clicar no card normal (painel de contacto ou `/leads/[id]`).
- O pill "Xd" no card normal e o texto no preview mostram o mesmo número de dias, e esse número volta a 0 imediatamente depois de mover o card de etapa (arrastar ou editar `stage_id`).
