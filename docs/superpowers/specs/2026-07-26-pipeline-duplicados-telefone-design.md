# Badges de tipo no card, telefone formatado, duplicados de contactos, duplicar card e "+ Contactos"

**Data:** 2026-07-26
**Origem:** feedback do cliente sobre o pipeline (mensagem direta ao Tomás, resumida abaixo).

## Contexto

Depois das correções da spec `2026-07-24-pipeline-contacto-formulario-unificado`, o cliente reportou mais 5 pedidos:

1. Contactos com mais do que um tipo (ex: comprador **e** vendedor) só mostram um badge no card do Kanban — quer todos.
2. Telefones aparecem colados ao indicativo (`351987233111`) — quer separado e legível (`+351 987233111`).
3. Receia que contactos fiquem duplicados no futuro (ex: um número já existe num contacto, e volta a entrar via sincronização do iCloud ou de outra origem) — quer deteção de duplicados, com possibilidade de os juntar.
4. Quer poder duplicar um card na pipeline, para quando o mesmo contacto tem mais do que um imóvel à venda em simultâneo (etapas independentes por imóvel).
5. Quer um botão "+ Contactos" na pipeline para adicionar contactos já existentes, com lista A-Z e pesquisa por nome ou telefone.

## Investigação no código

- `components/pipeline/KanbanBoard.tsx:34` — `contactTypeMeta(lead.people.types[0])`, só usa o primeiro tipo. `components/contacts/ContactTypeChips.tsx` já existe e renderiza todos os tipos, usado noutros sítios.
- `lib/whatsapp/utils.ts` — `normalizePhone(phone)` já normaliza para `351912345678` (sem `+`, sem espaços); não há nenhuma função de formatação para leitura.
- `supabase/migrations/20260707_auto_contact_trigger.sql` — o trigger `ensure_lead_contact` cria sempre um contacto novo quando uma lead chega sem `person_id` (formulário público, bot do Idealista, etc.), **sem verificar** se já existe um contacto com o mesmo telefone. É a causa mais provável de duplicados.
- Tabelas com FK para `people.id` (confirmado na base de dados viva, projeto `sxenhpowxhexcggkepen`, via `information_schema` — os ficheiros de migration não são a fonte fiável, como já documentado na spec `2026-07-21`):
  - `activities.person_id` (nullable, `ON DELETE SET NULL`)
  - `contact_interactions.person_id` (`ON DELETE CASCADE`)
  - `lead_preferences.person_id` (nullable, **`UNIQUE`**)
  - `leads.person_id` (nullable, `ON DELETE SET NULL`)
  - `properties.seller_id` / `properties.buyer_id` (nullable, `ON DELETE SET NULL`)
  - `property_consultants.person_id` (`NOT NULL`, **`UNIQUE (property_id, person_id)`**)
  - `property_visits.person_id` (nullable, `ON DELETE SET NULL`)
  - Nota: `/api/contact-preferences/[id]` e `/api/lead-preferences/[id]` usam a **mesma** tabela `lead_preferences` (colunas `lead_id` e `person_id`, ambas nullable e cada uma com `UNIQUE` própria) — não há tabela `contact_preferences` separada.
- `components/pipeline/PipelineBoard.tsx` — hoje só tem os botões "+ Imóveis" e "+ Novo Lead" (o antigo "+ Contactos" foi removido na spec `2026-07-21`, substituído por "+ Imóveis"). O componente antigo `components/pipeline/ContactPickerModal.tsx` (apagado no commit `a181e4d`) tinha exatamente o padrão pedido agora — lista A-Z, pesquisa por nome, checkboxes — falta-lhe só a pesquisa por telefone.
- `app/api/pipelines/[id]/add-properties/route.ts` é o padrão já existente para "adicionar vários de uma vez a uma pipeline" (endpoint em lote, 1ª etapa, bloqueio de duplicados por combinação de campos) — a nova rota de contactos segue a mesma estrutura.

## Decisões confirmadas com o utilizador

- Duplicados: a deteção é automática e sempre visível, mas **juntar é sempre uma ação explícita do utilizador** (não há junção automática/silenciosa). A ação de juntar é construída agora (não só o aviso).
- Duplicar um card na pipeline: a cópia **não leva o imóvel** do card original — fica sem imóvel associado, para o utilizador ligar ao imóvel certo depois.
- "+ Contactos": volta a existir, **ao lado** de "+ Imóveis" e "+ Novo Lead" (não substitui nenhum dos dois).
- Telefone: formata-se tanto na leitura como na escrita — nos campos de edição, a formatação aplica-se ao sair do campo (`onBlur`), não a cada tecla.

## A. Todos os tipos no card do Kanban

`components/pipeline/KanbanBoard.tsx`, `LeadCard`: troca o badge único (linhas ~34 e ~57-61) por `<ContactTypeChips types={lead.people?.types ?? []} size={9} />`, importado de `@/components/contacts/ContactTypeChips`. Mantém-se ao lado do nome, com `flexWrap: 'wrap'` no contentor para não rebentar o layout quando há vários tipos.

## B. Formato do telefone

Nova função em `lib/whatsapp/utils.ts`:

```ts
// Formata para leitura: "+351 987233111". Números que não normalizam para
// 9 dígitos após o 351 (estrangeiros, incompletos) mostram-se com o
// indicativo detetado separado por espaço na mesma; sem indicativo
// reconhecível, devolve o valor original tal como foi guardado.
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone)
  if (/^351\d{9}$/.test(normalized)) return `+351 ${normalized.slice(3)}`
  if (/^\d{8,15}$/.test(normalized)) {
    // Indicativos temos como 1-3 dígitos; sem tabela de indicativos,
    // assume-se que os primeiros 3 dígitos são o indicativo quando o
    // número é mais longo que um número nacional de 9 dígitos.
    return normalized.length > 9 ? `+${normalized.slice(0, normalized.length - 9)} ${normalized.slice(-9)}` : phone
  }
  return phone
}
```

Usada (substitui a interpolação direta de `.phone`) em:
- `app/(app)/people/page.tsx` (lista, linhas 65/75/80 — texto; o `href="tel:"` mantém-se com o valor normalizado, não o formatado, porque `tel:` não deve levar espaços)
- `components/contacts/ContactDetailPanel.tsx` (vista não-editável do telefone)
- `app/(app)/leads/[id]/page.tsx` (linha 349, bloco de detalhes)
- `components/leads/LinkContactModal.tsx` (linha 70)

Nos formulários de edição (`NewContactModal.tsx` via `ContactFormFields`? não — o campo telefone vive fora do `ContactFormFields`, nos três sítios que o têm: `NewContactModal.tsx`, `NewLeadModal.tsx`, `ContactDetailPanel.tsx` modo edição), o `<input>` de telefone ganha `onBlur={() => setPhone(formatPhoneDisplay(phone))}` (ou equivalente consoante o nome do state em cada ficheiro) — reformata só quando o campo perde o foco, nunca a cada tecla.

## C. Duplicados de contactos

### Deteção

Novo endpoint `GET /api/people/duplicates`: busca todos os `people` da agência com `phone` preenchido, agrupa por `normalizePhone(phone)`, devolve só os grupos com 2+ pessoas:

```ts
type DuplicateGroup = { phone: string; people: Person[] }
```

### UI

Nova página `app/(app)/people/duplicates/page.tsx`, link "⚠ N duplicados" a partir do cabeçalho de `/people` (só aparece quando há grupos). Lista cada grupo com as pessoas lado a lado (nome, email, telefone formatado, data de criação, nº de negócios via `leads?.length`), botão **"Juntar"** por grupo abre um modal simples: duas colunas (ou N colunas se houver mais que 2), cada uma com um botão "Manter este" — ao clicar, esse fica como `primary_id`, os restantes do grupo como `duplicate_ids`.

### Junção

Nova migration com a função `merge_people(p_primary_id uuid, p_duplicate_id uuid)`, `security definer`, chamada via RPC a partir de `POST /api/people/merge` (`{ primary_id, duplicate_id }`, um par de cada vez — juntar 3+ pessoas do mesmo grupo repete a chamada para cada duplicado):

```sql
create or replace function public.merge_people(p_primary_id uuid, p_duplicate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reatribuições diretas (sem risco de conflito de unicidade)
  update public.activities set person_id = p_primary_id where person_id = p_duplicate_id;
  update public.contact_interactions set person_id = p_primary_id where person_id = p_duplicate_id;
  update public.leads set person_id = p_primary_id where person_id = p_duplicate_id;
  update public.properties set seller_id = p_primary_id where seller_id = p_duplicate_id;
  update public.properties set buyer_id = p_primary_id where buyer_id = p_duplicate_id;
  update public.property_visits set person_id = p_primary_id where person_id = p_duplicate_id;

  -- property_consultants: UNIQUE(property_id, person_id) — apaga o do
  -- duplicado onde o principal já é consultor no mesmo imóvel, reatribui o resto
  delete from public.property_consultants pc_dup
    using public.property_consultants pc_primary
    where pc_dup.person_id = p_duplicate_id
      and pc_primary.person_id = p_primary_id
      and pc_primary.property_id = pc_dup.property_id;
  update public.property_consultants set person_id = p_primary_id where person_id = p_duplicate_id;

  -- lead_preferences: UNIQUE(person_id) — mantém as do principal se já existirem,
  -- senão herda as do duplicado
  delete from public.lead_preferences
    where person_id = p_duplicate_id
      and exists (select 1 from public.lead_preferences where person_id = p_primary_id);
  update public.lead_preferences set person_id = p_primary_id where person_id = p_duplicate_id;

  -- Preenche campos vazios do principal a partir do duplicado; junta notas
  update public.people primary_row set
    email = coalesce(primary_row.email, dup.email),
    phone = coalesce(primary_row.phone, dup.phone),
    address = coalesce(primary_row.address, dup.address),
    notes = case
      when primary_row.notes is null or primary_row.notes = '' then dup.notes
      when dup.notes is null or dup.notes = '' then primary_row.notes
      else primary_row.notes || E'\n\n---\n' || dup.notes
    end
  from public.people dup
  where primary_row.id = p_primary_id and dup.id = p_duplicate_id;

  delete from public.people where id = p_duplicate_id;
end;
$$;
```

`app/api/people/merge/route.ts` (`POST`): valida que ambos os `id` pertencem à mesma agência do utilizador autenticado, chama `supabase.rpc('merge_people', { p_primary_id, p_duplicate_id })`.

## D. Duplicar card na pipeline

Ícone "⧉" no `LeadCard` (hover, ao lado do avatar/nome), chama `POST /api/leads` com os campos do lead original copiados (`name`, `email`, `phone`, `person_id`, `organization_id`, `zone`, `typology`, `budget`, `notes`, `source`, `pipeline_id`, `stage_id` — todos os do card atual) **exceto** `property_id` (fica `null`) e `deal_value`/`expected_close_date`/`custom_fields` (ficam vazios, é um negócio novo). Sem modal — ação direta com um pequeno `confirm()` ("Duplicar este card? Cria uma nova entrada para o mesmo contacto, sem imóvel associado.").

## E. "+ Contactos" na pipeline

Recupera `components/pipeline/ContactPickerModal.tsx` do histórico do git (commit `a181e4d~1`), com estas mudanças:
- Pesquisa passa a filtrar por nome **ou** telefone (`p.name` ou `p.phone`, case-insensitive, ignorando não-dígitos no lado do telefone para aceitar pesquisa parcial tipo "9872").
- Chama um novo endpoint `POST /api/pipelines/[id]/add-contacts` (mesma estrutura do `add-properties` já existente): body `{ person_ids: string[] }`, cria uma lead por pessoa na 1ª etapa da pipeline, `property_id: null`, copiando `zone`/`typology` de `details.search_zone`/`details.selling_zone`/`typology` da pessoa (mesma lógica do `POST /api/people/[id]/pipeline` já existente). Bloqueia duplicados por `(person_id, pipeline_id)` com lead ativa (mesma regra do endpoint de pipeline único já existente).

`PipelineBoard.tsx`: novo botão "+ Contactos" antes de "+ Imóveis", abre `ContactPickerModal` passando `alreadyInIds` (pessoas com lead ativa nesta pipeline, calculado a partir de `leads` já carregadas no board).

## Fora do âmbito

- Junção automática/silenciosa de duplicados — rejeitada explicitamente pelo utilizador.
- Editar o botão "Duplicar" para escolher que campos copiar — copia sempre o mesmo conjunto fixo.
- Detetar duplicados por email (só por telefone, como pedido) — pode ser considerado depois se for preciso.

## Testes / verificação

- `tsc --noEmit`.
- Contacto com tipos `['comprador','vendedor']` mostra os dois badges no card.
- Guardar um telefone `912345678` e ver `+351 912345678` na lista de Contactos, ficha do Contacto e ficha da Lead; o link de WhatsApp/`tel:` continua a funcionar.
- Criar dois contactos com o mesmo telefone (de propósito) → aparecem juntos em `/people/duplicates`; juntar um no outro; confirmar que negócios/atividades/interações do apagado aparecem agora no que ficou, e que o apagado desaparece de `/people`.
- Duplicar um card na pipeline → aparece um novo card com o mesmo contacto, mesma etapa, sem imóvel.
- "+ Contactos" → escolher 2 contactos existentes, confirmar que aparecem como leads na 1ª etapa da pipeline atual, sem imóvel; contactos já na pipeline aparecem desativados na lista.
