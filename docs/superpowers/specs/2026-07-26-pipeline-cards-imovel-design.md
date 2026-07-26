# Pipeline cards — associação de imóvel e configuração de campos

Data: 2026-07-26

## Problema

1. Quando um contacto já existente é adicionado a uma pipeline (`+ Contactos`, ou "adicionar a pipelines" na ficha de contacto), o card criado nunca fica ligado a um imóvel (`property_id` fica sempre `null`). Isto quebra dois fluxos:
   - A configuração de "info principal/secundária" do card (`card_primary_field`/`card_secondary_field`), quando definida como `property`, não mostra nada nesse card.
   - A secção "Negociações em curso" na ficha do imóvel (`PropertyNegotiations`) nunca lista esse card como candidato a comprador, porque filtra leads por `property_id`.
2. Quando um contacto tem mais do que um imóvel associado (ex: vende duas casas), cada card na pipeline devia poder ser editado para escolher a que imóvel especificamente se refere.
3. Os cards do Kanban são demasiado estreitos e o texto configurável corta com reticências (ex: "Imóvel T3...").

O modelo de "comprador" em si (vários candidatos durante a negociação + um comprador final) **já existe** e não precisa de alterações de esquema: `properties.buyer_id` (`supabase/migrations/20260719_property_buyer.sql`), `PropertyBuyer.tsx` e `PropertyNegotiations.tsx` (que lista leads por `property_id` e tem o botão "Foi este o comprador"). O que falta é garantir que os cards ficam corretamente ligados ao imóvel certo.

## Parte 1 — Derivar o imóvel associado ao criar um card para um contacto existente

### Fonte dos imóveis candidatos de uma pessoa

Um `person_id` pode já estar associado a imóveis de três formas (todas já existentes e devolvidas por `GET /api/people/[id]`):
- `properties_as_seller` (`properties.seller_id`)
- `properties_as_buyer` (`properties.buyer_id`)
- `property_consultants` → `properties`

Nova função utilitária (ex: `lib/pipeline/resolve-contact-property.ts`), usada nas rotas de criação de card:
- Recebe `supabase`, `agency_id`, `person_id`.
- Faz um único query (ou reaproveita as 3 já existentes) para juntar estas três listas, deduplicadas por `property_id`.
- Devolve a lista de imóveis candidatos (`{id, title, reference, zone, typology, price}`).

### Regra ao criar o(s) card(s)

- **0 imóveis candidatos** → comportamento atual: `property_id: null`, zona/tipologia vindas de `person.details` (`search_zone`/`selling_zone`/`typology`).
- **1 imóvel candidato** → usa-o automaticamente: `property_id` = esse imóvel, e `zone`/`typology`/`budget` copiados do imóvel (mesmo padrão do `add-properties/route.ts`), tal como acontece hoje no fluxo "+ Imóveis".
- **2+ imóveis candidatos** → não decide sozinho; o utilizador escolhe antes de o card ser criado (ver UI abaixo). Se o utilizador não escolher (fechar/pular), cria sem imóvel (`property_id: null`), igual ao caso de 0.

Esta regra aplica-se às duas rotas que hoje criam cards para contactos existentes:
- `POST /api/pipelines/[id]/add-contacts` (lote, botão `+ Contactos`)
- `POST /api/people/[id]/pipeline` (individual, a partir da ficha de contacto)

O fluxo `+ Imóveis` (`add-properties/route.ts`) e o de duplicar card (`property_id: null` deliberado) não são alterados.

### UI — escolher o imóvel quando há ambiguidade

- **Ficha de contacto (`ContactDetailPanel`, adicionar a pipelines)**: se a pessoa tiver 2+ imóveis candidatos, ao confirmar a seleção de pipelines mostra um pequeno passo extra (mesmo modal ou um segundo ecrã) a pedir para escolher um imóvel da lista (ou "sem imóvel"), antes de chamar `POST /api/people/[id]/pipeline` com o `property_id` escolhido.
- **`ContactPickerModal` (+ Contactos, em lote)**: depois de confirmar os contactos selecionados, para cada um que tiver 2+ imóveis candidatos, mostra uma lista curta (nome do contacto + dropdown de imóvel) antes de submeter ao `add-contacts`. Contactos com 0 ou 1 imóvel não aparecem nesse passo extra.
- Ambas as rotas passam a aceitar um `property_id` (ou um mapa `person_id → property_id` no caso do lote) opcional no corpo do pedido, usado em vez da derivação automática quando fornecido.

## Parte 2 — Editar o imóvel de um card já criado

- Novo ícone 🏠 no cabeçalho do `LeadCard` (`components/pipeline/KanbanBoard.tsx`), ao lado do ⧉ (duplicar), com `stopPropagation` para não disparar o clique do card (que continua a abrir o contacto/lead).
- Abre um modal de pesquisa de imóveis (mesmo padrão do `PropertyBuyer.tsx`: pesquisa por referência/título/morada, lista de resultados clicável), permitindo escolher **qualquer imóvel da agência** — não só os já associados ao contacto — ou remover o imóvel atual.
- Ao escolher, faz `PATCH /api/leads/[id]` com `property_id` + `zone`/`typology`/`budget` copiados do imóvel escolhido (mesma cópia usada na Parte 1), ou `property_id: null` + mantém zona/tipologia atuais se remover.
- Isto cobre também o caso de um contacto duplicado para uma segunda casa (`ea4e4f0`): o card duplicado nasce sem imóvel e agora pode ser associado a um pelo ícone 🏠.

## Parte 3 — Layout do card

Em `components/pipeline/KanbanBoard.tsx`:
- Largura da coluna: `minWidth/width: 240` → `~300–320px`.
- Texto principal e secundário do card: hoje usam `overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap`. Passam a permitir quebra até 2 linhas (`display: -webkit-box; WebkitLineClamp: 2; WebkitBoxOrient: vertical; whiteSpace: normal; overflow: hidden`), crescendo a altura do card quando necessário.

## Fora de âmbito

- Nenhuma alteração de esquema de base de dados (não é preciso `property_id` novo nem tabela de candidatos — os "candidatos a comprador" já são representados pelos `leads` ligados ao imóvel).
- Sem botão novo na ficha do imóvel para adicionar candidato diretamente (decisão do utilizador: só corrigir o bug de raiz).
- `add-properties/route.ts` e o fluxo de duplicar card não mudam de comportamento.

## Testes a cobrir

- Adicionar contacto com 0, 1 e 2+ imóveis associados via `+ Contactos` (lote) e via ficha de contacto (individual) — confirmar `property_id`/`zone`/`typology`/`budget` corretos em cada caso.
- Card com `card_primary_field`/`card_secondary_field` = `property` mostra o valor certo nos três casos acima.
- Ícone 🏠 troca o imóvel de um card existente e atualiza campos copiados; remover imóvel limpa `property_id` sem apagar zona/tipologia manuais.
- `PropertyNegotiations` na ficha do imóvel passa a listar um card criado via `+ Contactos` quando o imóvel foi corretamente associado.
- Layout: título de imóvel longo não corta em `property` como principal/secundário, em desktop e mobile.
