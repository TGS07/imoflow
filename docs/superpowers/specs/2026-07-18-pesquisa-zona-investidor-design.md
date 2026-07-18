# Pesquisa por zona nos contactos + investidor com campos de venda

**Data:** 2026-07-18 · **Estado:** aprovado pelo utilizador (conversa)

## Contexto

Dois pedidos pequenos do cliente, seguintes na fila depois do "contacto
unificado" (PR #10, branch `claude/friendly-hugle-608f66` — este spec assenta
em cima desse branch):

1. "Na barra de pesquisa pesquisar tipo uma zona e aparecer nos contactos" —
   hoje o CommandPalette (Cmd+K) só pesquisa leads (nome/email/telefone) e
   páginas; `GET /api/people?search=` só olha para nome/email/telefone.
   As zonas vivem em `people.details` (jsonb): `search_zone` (comprador/
   investidor), `selling_zone` (vendedor), `working_zone` (consultor/serviço).
2. "Investidor pode querer vender — falta uma opção que pergunte o que
   oferece" — a ficha de investidor só mostra `looking_for`/`search_zone`/
   `already_bought`; os campos de venda existem no mesmo jsonb mas só
   aparecem para o tipo "vendedor".

Decisões tomadas na conversa:
- Investidor ganha os **campos estruturados iguais aos do vendedor** (não um
  campo de texto livre novo).
- Pesquisa por zona funciona **na barra global (Cmd+K) E na página de
  Contactos**.

Sem alterações à base de dados em nenhuma das features.

## 1. Investidor mostra os campos de venda

- `components/contacts/ContactDetailPanel.tsx` (serve a página `/people/[id]`
  e a gaveta da pipeline): o bloco de venda na secção "Detalhes"
  (`selling_property`, `selling_zone`, `selling_price`, `typology`,
  `has_garage`, `has_balcony`, `has_exclusivity`, `is_active_seller`) passa a
  aparecer quando o contacto tem tipo **vendedor OU investidor** (hoje:
  `showSeller = types.includes('vendedor')`).
- Rótulo do primeiro campo: quando o contacto é investidor **sem** o tipo
  vendedor, mostra **"O que oferece"** em vez de "O que vende" (mesmo campo
  `selling_property` por baixo). Com ambos os tipos, mantém "O que vende".
- `components/contacts/NewContactModal.tsx`: mesma regra no formulário de
  criação/edição — o bloco de venda aparece para investidor, com o mesmo
  rótulo condicional.
- Evitar duplicação de campos quando o contacto é vendedor E investidor: o
  bloco de venda renderiza uma única vez.

## 2. Pesquisa por zona

### API
`GET /api/people?search=` (`app/api/people/route.ts`): o `.or()` atual

```
name.ilike.%term%,email.ilike.%term%,phone.ilike.%term%
```

passa a incluir também:

```
address.ilike.%term%,details->>search_zone.ilike.%term%,details->>selling_zone.ilike.%term%,details->>working_zone.ilike.%term%
```

A página de Contactos (`app/(app)/people/page.tsx`) já pesquisa via esta API,
por isso ganha a pesquisa por zona sem mudanças próprias (confirmar no
plano; se filtrar client-side, alinhar).

### Barra global (Cmd+K)
`components/CommandPalette.tsx`: além das secções "Páginas" e "Leads", nova
secção **"Contactos"**:
- Mesmo debounce/termo da pesquisa de leads; chama
  `/api/people?search={term}` em paralelo.
- Mostra os primeiros 5 resultados: nome + linha secundária com a zona
  encontrada (primeira não vazia entre `search_zone`/`selling_zone`/
  `working_zone`/`address`) e/ou tipos do contacto.
- Selecionar navega para `/people/{id}`.
- Integra na navegação por teclado existente (setas/Enter) como as outras
  secções.

## Fora do âmbito

- Pesquisar nas zonas das preferências Idealista (`lead_preferences.zonas`,
  array noutra tabela — exigia join; as zonas do perfil cobrem o pedido).
- Alterações ao prompt de extração por voz (IA) para o campo de oferta do
  investidor — os campos já existem no schema de vendedor.
- Restantes pedidos do cliente (cards configuráveis, notificações por etapa,
  imóvel↔comprador) — specs próprios a seguir.

## Testes / verificação

- `npx tsc --noEmit` e `npm run build`.
- Preview: pesquisar uma zona (ex: "Parede") no Cmd+K → contactos com essa
  zona aparecem na secção "Contactos" e navegam para a ficha; mesma pesquisa
  na página de Contactos devolve-os na lista; ficha de um contacto só
  investidor mostra o bloco de venda com rótulo "O que oferece"; contacto
  vendedor+investidor mostra o bloco uma única vez com "O que vende".
