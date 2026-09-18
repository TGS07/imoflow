# Pipeline Updates & Bug Fixes — Design Spec

## Scope

9 alterações à pipeline do ImoFlow: 4 features novas, 3 bug fixes, 2 melhorias UX.

---

## 1. Multi-seleção de cards

**Objetivo:** Selecionar vários cards ao mesmo tempo para ações em bulk (mover de fase, remover da pipeline).

**UX:**
- Checkbox visível no canto superior esquerdo de cada card (desktop only).
- Ao selecionar 1+ cards, aparece uma **barra de ações flutuante** no fundo do board com:
  - Contador: "3 selecionados"
  - Botão "Mover para fase" → dropdown com fases da pipeline atual
  - Botão "Remover da pipeline" → confirmação
  - Botão "Limpar seleção" (×)
- Shift+click para selecionar um range de cards na mesma coluna.
- A seleção limpa-se ao mudar de pipeline.

**Implementação:**
- Estado `selectedCardIds: Set<string>` no `KanbanBoard`.
- Checkbox no `LeadCard` (controlado por `selectedCardIds`).
- Componente `BulkActionBar` fixo no bottom do board.
- API: novo endpoint `PATCH /api/leads/bulk` que aceita `{ ids: string[], stage_id?: string, remove?: boolean }`.
- Quando `remove: true`, faz DELETE de cada lead (remove da pipeline, não elimina contacto nem dados).

---

## 2. Remover card da pipeline

**Objetivo:** Botão no card para remover da pipeline sem eliminar o contacto/lead.

**UX:**
- Novo botão (ícone ×) nos action buttons do card (junto ao duplicar e imóvel).
- Ao clicar: confirmação "Remover da pipeline? O contacto não será eliminado."
- Ao confirmar: DELETE `/api/leads/{id}` (já existe, remove a lead que é o "card").

**Nota:** A lead É o card da pipeline. Removê-la da pipeline = apagar a lead. O contacto (person) permanece intacto. Este comportamento já é consistente com o botão "Remover" no ContactDetailPanel.

---

## 3. Fix: drag-and-drop a arrastar o card errado

**Problema:** O PointerSensor com distância de ativação de 8px por vezes capta o card adjacente em vez do pretendido, especialmente quando os cards são pequenos e próximos.

**Causa raiz:** Os cards atuais são muito compactos (~70px de altura) e os `useSortable` listeners cobrem o card inteiro incluindo a zona de hover. O `onMouseEnter` do hover preview interfere com os listeners de drag.

**Fix:**
- Aumentar `activationConstraint.distance` de 8 para 10px.
- Adicionar `activationConstraint.tolerance` de 5px para ignorar micromovimentos.
- Os cards maiores (feature #4) naturalmente reduzem o problema ao aumentar a área clicável.
- Mover o hover delay de `onMouseEnter` do card para um timeout que se cancela ao iniciar drag (`onDragStart` limpa o timer).
- Desativar hover preview durante drag ativo (`isDragging` state).

---

## 4. Cards maiores com mais informação (desktop)

**Objetivo:** Cards expandidos que mostram toda a informação relevante, com campos configuráveis.

**Schema — novo campo na lead:**
- Adicionar coluna `property_type` (text, nullable) à tabela `leads` com CHECK constraint: `('apartamento','moradia','terreno','loja','escritorio','armazem','outro')`.
- Quando a lead tem `property_id`, o tipo vem de `properties.type`. Quando não tem, usa `leads.property_type`.

**Schema — campos configuráveis na pipeline:**
- Substituir `card_primary_field` e `card_secondary_field` por `card_fields` (jsonb) na tabela `pipelines`.
- Formato: `["name", "phone", "price", "typology", "zone", "property_type", "property_ref", "call_status"]`
- Array ordenado — a ordem define a prioridade visual no card.
- Manter retrocompatibilidade: se `card_fields` é null, usar `[primary, secondary]` legacy.

**Card layout (desktop):**
- Largura mínima das colunas: de ~220px para ~280px.
- Card com padding aumentado (14→16px).
- Header: checkbox + avatar + nome + telefone (sempre visíveis).
- Body: badges/tags para os campos selecionados (preço, tipologia, zona, AP/M/T, ref. imóvel, etc.).
- Footer: dias na fase + data prevista.
- **Layout adaptável:** poucos campos → badges maiores com mais espaço; muitos campos → badges compactam (font-size menor, menos padding).

**Card layout (mobile):** Mantém o tamanho atual (compacto). Sem checkbox.

**PipelineSettingsModal — nova UI de campos:**
- Substituir os 2 dropdowns (primary/secondary) por uma lista de checkboxes com todos os campos disponíveis.
- Drag para reordenar os campos selecionados (ou setas ↑↓).
- Campos disponíveis: Nome, Telefone, Email, Preço/Valor, Tipologia, Zona, Tipo imóvel (AP/M/T), Ref. imóvel, Estado chamada, Fonte, Notas.

---

## 5. Gestão de chamadas — opções rápidas no ContactSlideOver

**Objetivo:** Na secção de interações do painel lateral, ao registar uma chamada, ter opções pré-definidas para o resultado.

**UX:**
- Na secção "Interações" do `ContactSlideOver` / `ContactDetailPanel`, quando o tipo é "chamada":
  - Mostrar botões rápidos antes do campo de notas: "Atendeu", "Não atendeu", "Não atendeu 2x", "Caixa de correio", "Número errado"
  - O utilizador pode clicar num botão OU escrever à mão no campo de notas.
  - Ao clicar num botão pré-definido, preenche automaticamente o campo `title` da interação com essa opção.
- O **último estado de chamada** aparece como badge no card da pipeline (se o campo `call_status` estiver ativo nos campos do card).

**Schema:**
- Usar o campo `title` já existente na tabela `contacts` (interações) para guardar o resultado da chamada.
- Para mostrar no card da pipeline: query da última interação tipo "chamada" da lead, ler o `title`.
- Sem alterações de schema necessárias.

---

## 6. Arrastar card para outra pipeline

**Objetivo:** Pegar num card e arrastá-lo até ao tab/título de outra pipeline para movê-lo.

**UX:**
- Os tabs das pipelines tornam-se drop targets durante um drag.
- Visual feedback: tab fica highlighted (cor accent, borda) quando o card está sobre ele.
- Ao largar: o card move-se para a **primeira fase** da pipeline destino.
- Internamente: `PATCH /api/leads/{id}` com `{ pipeline_id, stage_id }` (stage_id = primeira fase não-lost da pipeline destino).

**Implementação:**
- Registar cada tab de pipeline como `useDroppable` com id `pipeline-tab-{pipelineId}`.
- No `handleDragEnd`, detectar se o target é um tab de pipeline (id começa com `pipeline-tab-`).
- Se sim: buscar a primeira stage da pipeline destino e mover a lead.
- O card desaparece da pipeline atual (já que mudou de pipeline).

---

## 7. Fix: botões de fase no contacto não funcionam

**Problema:** No `ContactDetailPanel`, as fases de todas as pipelines aparecem mas clicar não move o card. O utilizador espera que ao clicar numa fase, o card mude para essa fase.

**Situação atual:** Já existe um `<select>` dropdown que funciona — faz `PATCH /api/leads/{id}` com o novo `stage_id`. Se o utilizador reporta que "não dá para mudar", pode ser:
1. O select não está a disparar o onChange corretamente.
2. Fases de outras pipelines aparecem misturadas.
3. A UI não refresca após a mudança.

**Fix:**
- Verificar e corrigir o onChange do select para garantir que a API é chamada.
- Garantir que cada select só mostra fases da pipeline correspondente à lead.
- Após mudança, fazer refresh dos dados da lead para atualizar a UI.
- Adicionar feedback visual (toast/loading) ao mudar de fase.

---

## 8. Datas especiais na criação de lead

**Objetivo:** Permitir adicionar datas específicas (visita, escritura, prazos) ao criar ou editar uma lead.

**UX:**
- No `NewLeadModal`, na secção "Negócio", adicionar um campo repetível "Datas":
  - Cada entrada: label (texto livre, ex: "Escritura", "Visita") + data (date picker).
  - Botão "+ Adicionar data" para mais entradas.
- Na edição da lead (LeadDetailPage ou ContactSlideOver), mesma UI.

**Schema:**
- Adicionar coluna `special_dates` (jsonb, default '[]') à tabela `leads`.
- Formato: `[{ "label": "Escritura", "date": "2026-10-15" }, ...]`
- Mesmo formato usado em `people.special_dates`.

---

## 9. Fix: texto lento nas configurações da pipeline

**Problema:** Ao editar o nome de uma fase ou pipeline nas configurações, o texto demora a aparecer — cada keystroke provavelmente dispara uma chamada API.

**Causa raiz:** Os inputs nas settings fazem PATCH a cada onChange (cada caractere) sem debounce.

**Fix:**
- Converter os inputs de nome (fases e pipeline) para **controlled inputs com estado local**.
- Aplicar **debounce de 500ms** após o utilizador parar de escrever, só então chamar a API.
- Alternativa: usar `onBlur` em vez de `onChange` para só gravar quando o input perde o foco.
- Abordagem escolhida: **onBlur** — mais simples, sem timers, grava quando o utilizador sai do campo.

---

## Prioridade de implementação

1. **Bug fixes primeiro:** #3 (drag), #7 (fases contacto), #9 (texto lento) — impacto imediato, baixo risco.
2. **Schema changes:** #4 (card_fields + property_type), #8 (special_dates na lead) — migrações.
3. **Features de cards:** #4 (cards maiores), #5 (chamadas), #2 (remover card).
4. **Multi-seleção:** #1 — depende dos cards novos.
5. **Cross-pipeline drag:** #6 — feature independente, pode ser feita em paralelo.

---

## Ficheiros a modificar

| Ficheiro | Alterações |
|----------|-----------|
| `components/pipeline/KanbanBoard.tsx` | Cards maiores, multi-seleção, BulkActionBar, fix drag, remover card, cross-pipeline drop |
| `components/pipeline/PipelineBoard.tsx` | Pipeline tabs como drop targets, estado de seleção |
| `components/pipeline/PipelineSettingsModal.tsx` | UI de checkboxes para campos do card |
| `components/pipeline/ContactSlideOver.tsx` | Nenhuma (wrapper apenas) |
| `components/contacts/ContactDetailPanel.tsx` | Fix fase select, opções rápidas chamada |
| `components/leads/NewLeadModal.tsx` | Campo property_type, datas especiais |
| `app/(app)/settings/pipeline/page.tsx` | Debounce/onBlur nos inputs |
| `lib/pipeline/card-fields.ts` | Novos campos (phone, property_type, call_status) |
| `types/index.ts` | Atualizar PipelineCardField, Lead type |
| `app/api/leads/bulk/route.ts` | Novo endpoint bulk actions |
| `supabase/migrations/` | property_type na leads, card_fields na pipelines, special_dates na leads |
