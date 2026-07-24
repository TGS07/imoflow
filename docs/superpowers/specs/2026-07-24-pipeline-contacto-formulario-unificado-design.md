# Formulário unificado Lead/Contacto, link Idealista, multi-pipeline e eliminação sem bloqueios

**Data:** 2026-07-24
**Origem:** feedback do cliente sobre o pipeline (mensagem direta ao Tomás, resumida abaixo).

## Contexto

O cliente reportou uma lista de problemas sobre a criação e gestão de leads/contactos no pipeline:

1. O botão "Novo Lead" cria com muito menos opções do que editar um lead/contacto já existente. Falta poder escolher logo se é comprador/vendedor ao criar.
2. Os parâmetros de criação são diferentes consoante se cria um contacto ou uma lead — quer o mesmo esquema de campos em todo o lado, incluindo o tipo (comprador/vendedor/investidor, etc.).
3. Falta um campo para o link do anúncio do Idealista, tanto ao criar como nos contactos/leads já existentes.
4. Ao eliminar um contacto/lead da pipeline, teme que isso apague todos os dados desse contacto — só quer que saia da pipeline.
5. Ao eliminar uma pipeline, a app recusa se ainda houver contactos lá — quer poder eliminar na mesma.
6. Só consegue pôr o mesmo contacto numa pipeline de cada vez — quer poder pôr em várias.
7. Ao mudar o nome de um contacto, a pipeline continua a mostrar o nome antigo.

Investigação no código (worktree `zen-kare-42694c`) confirmou o estado atual de cada um destes pontos — ver secções abaixo. Várias destas queixas coincidem com trabalho de specs anteriores (`2026-07-17-contacto-unificado-pipeline`, `2026-07-21-pipeline-vendedores-fixes`) que já resolveram parte do problema (ex. um contacto já pode estar em várias pipelines a nível de API, remover da pipeline já preserva os dados) — o que falta é sobretudo a UI de criação e dois bugs/limitações concretos.

## Decisões confirmadas com o utilizador

- Formulário de criação de lead e de contacto passam a partilhar exatamente os mesmos campos (tipo, detalhes, capacidade financeira, etc.) — um formulário só, reutilizado nos dois sítios.
- Link do Idealista: campo de texto livre, sempre visível (não depende do tipo comprador/vendedor), tanto em contactos/leads como em imóveis.
- Eliminar uma pipeline com leads: elimina sempre, sem aviso extra — os contactos nunca são apagados, só a ligação à pipeline.
- Seleção de pipelines (na criação e ao adicionar contacto existente a outra pipeline): checkboxes, permite marcar várias de uma vez.
- Não é preciso atalho de remover-da-pipeline diretamente no card do Kanban — mantém-se só no painel lateral do contacto, que já funciona corretamente.

## A. Formulário unificado Lead ↔ Contacto

**Estado atual:** `components/contacts/NewContactModal.tsx` tem tipo (`CONTACT_TYPES`: comprador/vendedor/investidor/consultor/serviço), capacidade financeira, origem, bloco de `ContactDetails` por tipo (zona/preço/tipologia/extras/já comprou/exclusividade/etc.), responsável, "contacto regular", nascimento, notas. `components/leads/NewLeadModal.tsx` só tem nome/email/telefone/origem/zona/tipologia/orçamento/notas + autocomplete de pessoa/organização/imóvel + campos personalizados + valor do negócio/data de fecho.

**Mudança:**

1. Extrair de `NewContactModal.tsx` um componente partilhado `components/contacts/ContactFormFields.tsx`:
   ```
   props: {
     types, onToggleType,
     capacity, onCapacityChange,
     source, onSourceChange,
     details, onDetailChange,
     assignedTo, onAssignedToChange, members,
     birthday, onBirthdayChange,
     isRegular, onIsRegularChange,
   }
   ```
   Contém: chips de tipo, bloco de capacidade financeira (se comprador/investidor), origem, blocos de detalhes por tipo (comprador/investidor, vendedor/investidor, consultor, serviço — incluindo o novo campo Idealista, ver B), responsável, nascimento, regular.
2. `NewContactModal.tsx` passa a usar este componente (comportamento inalterado, só reorganização).
3. `NewLeadModal.tsx`: quando **não** há pessoa escolhida no autocomplete, mostra `ContactFormFields` completo inline (substituindo os poucos campos soltos que tinha). Quando uma pessoa **é** escolhida no autocomplete, esconde `ContactFormFields` (os dados dela já existem e editam-se na ficha do contacto, não aqui) e mantém só os campos de negócio (imóvel, orçamento, valor, data de fecho, notas, origem, campos personalizados, pipelines — ver C).
4. Submissão do formulário:
   - Pessoa escolhida no autocomplete → usa esse `person_id` como hoje.
   - Pessoa não escolhida → `POST /api/people` primeiro com os campos de `ContactFormFields` + nome/email/telefone, obtém o `id`, depois cria a(s) lead(s) com esse `person_id`.
5. `types/contact.ts` e `NewContactModal` não mudam de modelo de dados — é só reutilização de UI.

## B. Link do anúncio Idealista

Campo novo, texto livre, opcional, **sempre visível** (não depende do tipo comprador/vendedor/investidor):

- `ContactDetails.idealista_url?: string` (novo campo em `types/contact.ts`). Aparece em `ContactFormFields` (logo em Novo Contacto e Novo Lead) e em `ContactDetailPanel.tsx` (visualização + edição), fora dos blocos condicionais de tipo — ao lado de Notas, por exemplo.
- `properties.idealista_url` — coluna nova (nullable, `text`) na tabela `properties`. Migration:
  ```sql
  ALTER TABLE public.properties ADD COLUMN idealista_url TEXT;
  ```
  Campo novo no formulário de imóvel (`app/(app)/properties/page.tsx`, `app/(app)/properties/[id]/page.tsx`) e no tipo `Property` (`types/index.ts`).
- Sem validação de formato — texto livre (o cliente pode colar qualquer link).

## C. Seleção múltipla de pipelines

**Na criação (`NewLeadModal.tsx`):** a prop `pipelineId?: string` passa a `defaultPipelineIds?: string[]`. O formulário busca `GET /api/pipelines` e mostra uma checkbox por pipeline. Pelo menos uma tem de ficar marcada para poder submeter (validação client-side, botão desabilitado se nenhuma marcada):
- Aberto de dentro de uma pipeline (`PipelineBoard.tsx:64`) → pré-marca só essa.
- Aberto de `/leads` (`app/(app)/leads/page.tsx:57`, sem pipeline de contexto) → pré-marca a primeira pipeline por `position`.

Ao submeter, itera as pipelines marcadas e cria uma lead em cada uma (1ª etapa dessa pipeline por `position`), todas com o mesmo `person_id`/`property_id`/dados de negócio. Reaproveita a lógica já existente em `POST /api/leads` (chamada em loop no cliente) — não precisa de endpoint novo.

**Em contacto já existente (`ContactDetailPanel.tsx`, botão "+ Pipeline", linhas 333-346):** o menu de "uma pipeline de cada vez" (`missingPipelines.map(p => <button onClick={() => addToPipeline(p.id)}>)`) passa a checkboxes + botão "Adicionar" que chama `addToPipeline` em sequência para cada uma marcada. `POST /api/people/[id]/pipeline` já aceita `pipeline_id` um de cada vez e já permite o mesmo contacto em várias pipelines simultaneamente (só bloqueia duplicado *dentro* da mesma pipeline) — nenhuma mudança de API necessária, só UI.

## D. Eliminar pipeline sem bloqueio

`app/api/pipelines/[id]/route.ts`, `DELETE`: hoje devolve 400 (`"Esta pipeline tem N contacto(s) — move-os ou remove-os primeiro."`) quando há leads. Passa a:
1. Apagar todas as leads com esse `pipeline_id` (`supabase.from('leads').delete().eq('pipeline_id', id)`).
2. Apagar a pipeline (o `ON DELETE CASCADE` existente entre `pipeline_stages` e `pipelines` trata das etapas).

Mantém-se a única validação que já existe: recusar se for a última pipeline da agência. `people`, `organizations` e `properties` nunca são tocados — só a tabela `leads` perde as linhas com esse `pipeline_id`. `PipelineBoard.tsx` (`deletePipeline`, linha 46-48) mantém o `confirm()` atual ("Eliminar a pipeline? As etapas são apagadas."), só deixa de tratar o erro 400 como bloqueio (porque deixa de existir).

## E. Nome do contacto desatualizado no card (bug fix)

**Causa:** `cardFieldValue` em `components/pipeline/KanbanBoard.tsx:13-24`, caso `'name'`, devolve sempre `lead.name` — uma cópia de texto guardada no momento em que a lead foi criada, que não é atualizada quando o contacto é renomeado depois.

**Correção:** no caso `'name'` de `cardFieldValue`, devolver `lead.people?.name ?? lead.name` (o nome do contacto ligado manda sempre que existe; só cai no nome guardado na lead para leads sem `person_id`). Consistente com o princípio já usado noutros campos (spec `2026-07-17`): quando há contacto associado, o contacto é a fonte da verdade.

## F. Remover da pipeline — confirma-se comportamento existente

`ContactDetailPanel.removeFromPipeline` (linhas 223-232) já chama `DELETE /api/people/[id]/pipeline?lead_id=`, que só apaga a linha da `lead` — nunca `people`/`organizations`/`properties`. Não há mudança de código aqui. Combinado com A (toda a lead nova passa a ter sempre um `person_id`, porque o formulário unificado obriga a criar/escolher sempre um contacto), deixa de poder existir o caso em que "eliminar da pipeline" apagava informação de contacto por essa informação nunca ter sido separada da lead. Sem atalho novo no card do Kanban — mantém-se só no painel lateral, por decisão do utilizador.

## Fora do âmbito

- Reescrever `/leads/[id]` ou `/people/[id]` — continuam a ser as páginas de edição completa, inalteradas.
- Notificações de etapa, Telegram, cards configuráveis — já cobertos por specs anteriores.
- Migração de dados de leads antigas sem `person_id` — continuam a funcionar como hoje (fallback), só deixam de ser criadas assim daqui para a frente.

## Testes / verificação

- `tsc --noEmit`.
- Criar um lead novo sem escolher pessoa existente: preencher tipo (vendedor), zona/preço de venda, link Idealista, marcar 2 pipelines → confirmar 2 leads criadas, uma por pipeline, e que foi criado um contacto novo com esses dados em `/people`.
- Criar um lead escolhendo uma pessoa já existente → confirmar que os campos de tipo/detalhes não aparecem (não haver duplicação) e que a lead fica ligada à pessoa certa.
- Editar o nome de um contacto em `/people/[id]`, voltar ao board da pipeline → confirmar que o card mostra o nome novo.
- Eliminar uma pipeline com leads → confirma que apaga sem bloqueio, os contactos continuam em `/people` intactos, e as leads dessa pipeline desaparecem do board.
- Adicionar um contacto existente a 2 pipelines de uma vez via checkboxes no "+ Pipeline".
- Preencher e guardar o link Idealista num contacto e num imóvel, confirmar persistência ao recarregar.
- Remover um contacto de uma pipeline via painel lateral → confirmar que o contacto e o histórico continuam intactos (comportamento já existente, só confirmar que não regride).
