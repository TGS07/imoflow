# Imóvel ↔ comprador (quem comprou / quem está a negociar)

**Data:** 2026-07-19 · **Estado:** aprovado pelo utilizador (conversa)

## Contexto

Último pedido da lista original do cliente: "imagine uma casa já vendida —
não consigo meter quem foi o comprador, ou até durante uma negociação quem
está a querer comprar a casa."

Estado atual: `properties.seller_id` existe (cartão "Vendedor" na ficha do
imóvel, componente `PropertySeller` com pesquisa de contactos); as leads já
apontam para imóveis via `leads.property_id`, mas a ficha do imóvel não
mostra quem está a negociar nem permite registar o comprador final.

Decisões: comprador único por imóvel (sem tabela de transações — YAGNI; o
`deal_value` da lead guarda o valor); negociações derivadas das leads.

Branch: `claude/notificacoes-etapa` → criar `claude/imovel-comprador`.
Sem push até ao fim (pedido do utilizador).

## 1. Dados

Migração `supabase/migrations/20260719_property_buyer.sql`:

```sql
-- Comprador (contacto) do imóvel — quem comprou, quando vendido.
alter table public.properties
  add column buyer_id uuid references public.people(id) on delete set null;

create index properties_buyer_idx on public.properties(buyer_id);
```

Aplicada ao Supabase via MCP pelo coordenador antes da verificação.
Tipo `Property` em `types/index.ts` ganha `buyer_id: string | null` (e o
join opcional `buyer?` se o GET o devolver, ver §2).

## 2. APIs

- `GET /api/properties/[id]`: devolve também
  `buyer:people!buyer_id(id, name, phone, email)` (mesmo formato do join do
  seller existente — verificar como o `seller` é hoje selecionado e imitar).
- `PATCH /api/properties/[id]`: aceita `buyer_id` (uuid ou null) — verificar
  se o PATCH é allowlist e acrescentar o campo.
- `GET /api/leads?property_id=`: novo filtro (mesmo padrão dos filtros
  `person_id`/`pipeline_id` existentes).
- `GET /api/people/[id]`: join novo
  `properties_as_buyer:properties!buyer_id(id, title, status, price, reference)`
  (mesmo formato do `properties_as_seller` existente).

## 3. Ficha do imóvel (`app/(app)/properties/[id]/page.tsx`)

- **Cartão "Comprador"** — novo `components/properties/PropertyBuyer.tsx`,
  espelho do `PropertySeller` (pesquisa por `/api/people?search=`,
  associar/remover via PATCH `buyer_id`, link para `/people/{id}`).
  Quando `status === 'vendido'` e sem comprador: aviso no cartão
  ("Vendido — sem comprador registado", tom de alerta suave).
- **Cartão "Negociações em curso"** — novo
  `components/properties/PropertyNegotiations.tsx`: lista as leads ativas
  (etapa não won/lost) com `property_id` = este imóvel, via
  `GET /api/leads?property_id=`. Cada linha: nome do contacto/lead,
  pipeline · etapa (chip com cor da etapa), link para `/leads/{id}`, e botão
  **"Foi este o comprador"** que:
  1. PATCH `buyer_id` = person_id da lead (fallback: se a lead não tem
     `person_id`, o botão não aparece nessa linha);
  2. `confirm()` "Marcar o imóvel como vendido?" → se sim, PATCH
     `status: 'vendido'`.
  Leads fechadas (won) com este imóvel aparecem numa sublista discreta
  "Negócios fechados" (sem botão se já houver comprador).
- Ambos os cartões na coluna onde estão `PropertySeller`/`SuggestedBuyers`.

## 4. Ficha do contacto (recíproco)

`components/contacts/ContactDetailPanel.tsx` (serve página e gaveta):
quando `properties_as_buyer` não está vazio, cartão **"Imóveis comprados"**
na coluna direita (formato do `SellerProperties`, sem ações de associação —
a associação faz-se na ficha do imóvel), com link para cada imóvel.

## Fora do âmbito

- Tabela de transações (preço/data de venda próprios — `deal_value` e
  `expected_close_date` da lead cobrem).
- Múltiplos compradores por imóvel.
- Automatismo "lead passou a won ⇒ definir comprador" (fica o atalho manual
  "Foi este o comprador"; automatizar mexeria no PATCH de leads e nos
  automatismos — pode ser follow-up).

## Testes / verificação

- `npx tsc --noEmit` e `npm run build`; migração aplicada e confirmada.
- Preview (dados reais, reverter no fim): associar comprador a um imóvel de
  teste; ver "Vendido — sem comprador registado" num vendido sem buyer;
  negociações em curso listadas num imóvel com leads ativas; atalho define
  buyer e pergunta pelo status; cartão "Imóveis comprados" na ficha do
  contacto; remover associações de teste no fim.
