# Siglas de contacto (definições) + preço na secção "Procura"

**Data:** 2026-07-29
**Status:** Aprovado para planeamento

## Contexto

Pedido com três partes. A parte sobre melhorar a "preferência do Idealista" foi retirada durante a conversa — o utilizador confirmou que não quer mexer nisso agora. Ficam duas partes, independentes entre si:

1. Uma lista de **siglas** (CC, CV, SCC, SR) que o utilizador já usa manualmente na configuração de contactos do iCloud/iPhone para classificar quem é quem (ex.: `CC` = Cliente Comprador). Não existe hoje nenhum sistema de siglas no código do ImoFlow — foi confirmado por exploração exaustiva (grep por "sigla", "acronym", "abbreviation" sem resultados). Pediu-se um sítio nas definições que mostre as siglas ativas e permita criar novas.
2. O formulário/painel de contacto tem uma secção "Procura" (visível para tipos `comprador`/`investidor`) com os campos `looking_for` e `search_zone`, mas falta um campo de preço — ao contrário da secção "Venda" (tipo oposto), que já tem `selling_price`.

## Parte A — Siglas de contacto

### Decisão de âmbito

- A sincronização de contactos do iPhone/iCloud **não está neste repositório** — é um processo externo, e o utilizador não sabe (ou não existe) ligação automática entre essa sincronização e o ImoFlow. Por isso, esta funcionalidade cria apenas a **lista oficial de siglas dentro do ImoFlow** (referência/definições); não liga, nem tenta ligar, à configuração de contactos do iPhone/iCloud. Se no futuro for identificado onde vive esse processo de sincronização, pode fazer-se essa ligação numa spec separada.
- CRUD reduzido ao pedido: **listar siglas ativas + criar novas**. Não inclui editar nem desativar siglas existentes (confirmado explicitamente com o utilizador).
- Seed inicial com as 4 siglas que o utilizador já usa:
  - `CC` — Cliente Comprador
  - `CV` — Cliente Vendedor
  - `SCC` — Contabilista
  - `SR` — Remodelações

### Modelo de dados

Nova tabela `contact_siglas`, seguindo o padrão de `custom_fields` (mesma migração de referência: `supabase/migrations/20260529_pipeline_stages.sql`, scoping por `agency_id` + RLS "own agency"):

```sql
create table public.contact_siglas (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  code text not null,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(agency_id, code)
);

create index contact_siglas_agency_idx on contact_siglas(agency_id);

alter table public.contact_siglas enable row level security;
create policy "contact_siglas: own agency" on public.contact_siglas
  for all using (agency_id = public.get_my_agency_id());
```

Seed (na mesma migração, por cada agência já existente — mesmo padrão do bloco `do $$ ... $$` de seed de stages em `20260529_pipeline_stages.sql`):

```sql
do $$
declare
  agency record;
begin
  for agency in select id from public.agencies loop
    insert into public.contact_siglas (agency_id, code, label) values
      (agency.id, 'CC', 'Cliente Comprador'),
      (agency.id, 'CV', 'Cliente Vendedor'),
      (agency.id, 'SCC', 'Contabilista'),
      (agency.id, 'SR', 'Remodelações')
    on conflict (agency_id, code) do nothing;
  end loop;
end $$;
```

`unique(agency_id, code)` impede criar duas siglas com o mesmo código na mesma agência — o formulário de criação deve mostrar o erro de conflito de forma legível (ver secção API).

### API

Novo ficheiro `app/api/contact-siglas/route.ts`, mesmo padrão de `app/api/custom-fields/route.ts`:

- `GET` — devolve as siglas da agência do utilizador autenticado, `is_active = true`, ordenadas por `code`.
- `POST` — só admin (`profile.role !== 'admin'` → 403, mesmo padrão). Body: `{ code: string, label: string }`. `code` é normalizado para maiúsculas e sem espaços no servidor antes de inserir. Em caso de conflito de `unique(agency_id, code)`, devolve 409 com mensagem `"Já existe uma sigla com este código."`.

Não há `PATCH`/`DELETE` nesta spec (fora de âmbito — ver acima).

### Página de definições

Nova página `app/(app)/settings/siglas/page.tsx`, `'use client'`, seguindo o padrão de `app/(app)/settings/pipeline/page.tsx` (fetch em `useEffect`, `inputStyle` local, sem framework de formulários):

- Lista as siglas ativas em cartões/linhas simples: código (destaque, ex. badge) + rótulo.
- Formulário de criação no topo ou fundo da lista: dois inputs (`código`, `rótulo`) + botão "Criar sigla". Ao submeter com sucesso, adiciona à lista local sem recarregar a página. Em caso de 409, mostra a mensagem de erro devolvida pela API junto ao formulário.
- Acesso restrito a admins — já garantido pelo `app/(app)/settings/layout.tsx` existente (redireciona não-admins para `/dashboard`), nenhuma alteração necessária aí.
- Nova entrada na navegação lateral, `components/layout/Sidebar.tsx`, junto às outras entradas de `section: 'Sistema'`:
  ```ts
  { href: '/settings/siglas', icon: 'form', label: 'Siglas', section: 'Sistema' },
  ```
  Não existe ícone `tag` no set atual (`components/ui/Icon.tsx`, tipo `IconName`); reutiliza-se `'form'` (já usado por "Formulários"), sem necessidade de criar um SVG novo.

## Parte B — Preço na secção "Procura"

### Modelo de dados

`ContactDetails` é `jsonb` dentro de `people.details` (sem colunas próprias, sem migração necessária). Adicionar um campo opcional em `types/contact.ts`:

```ts
looking_price?: number
```

Colocado junto aos restantes campos de "comprador / investidor" (`looking_for`, `search_zone`, `already_bought`), mesma secção do tipo.

### Formulário de criação/edição

`components/contacts/ContactFormFields.tsx`, dentro do bloco `{(has('comprador') || has('investidor')) && (...)}` (linhas 99-109), depois do campo "Zona":

```tsx
<input className="input" type="number" placeholder="Preço máximo (€)" value={details.looking_price ?? ''} onChange={e => onDetailChange('looking_price', Number(e.target.value) || undefined)} />
```

Mesmo padrão exato do `selling_price` já existente na secção "Venda" (linha 116).

### Painel de detalhe

`components/contacts/ContactDetailPanel.tsx`, dentro do bloco `showBuyer` (linhas ~655-659), depois do campo "Zona":

```tsx
{field('Preço máximo €', fieldValue(d.looking_price != null ? `€${d.looking_price.toLocaleString('pt-PT')}` : null), <input className="input" type="number" value={d.looking_price ?? ''} onChange={e => setDetail('looking_price', Number(e.target.value) || undefined)} />)}
```

Mesmo padrão exato do campo `selling_price` já existente no bloco `showSeller` (linha 662).

Não é necessária alteração na API (`PATCH /api/people/[id]` já aceita `details` como um todo, sem allowlist de subcampos).

## Fora de âmbito

- Qualquer ligação entre as siglas do ImoFlow e a sincronização/configuração de contactos do iPhone/iCloud — esse processo não está neste repositório.
- Editar ou desativar siglas existentes (só listar + criar).
- Associar siglas a `ContactTypeKey` ou a qualquer lógica de classificação automática de contactos — siglas ficam como lista de referência, sem efeito funcional noutras partes do sistema.
- Intervalo de preço (mínimo/máximo) em "Procura" — só um valor único (preço máximo), como no `selling_price`.
- Alterações à Parte relativa a preferências do Idealista — fora de âmbito, retirada do pedido original.

## Testes

**Siglas:**
- Aplicar a migração numa agência existente → confirmar que as 4 siglas (`CC`, `CV`, `SCC`, `SR`) aparecem em `GET /api/contact-siglas`.
- Aceder a `/settings/siglas` como admin → ver a lista das 4 siglas.
- Aceder a `/settings/siglas` como não-admin → redirecionado para `/dashboard` (comportamento herdado do layout, confirmar que não regride).
- Criar uma sigla nova (ex. `AV` — Avaliador) pela página → aparece na lista sem recarregar.
- Tentar criar uma sigla com um código já existente (ex. `CC`) → erro 409 tratado na UI, sigla não duplicada na BD.

**Preço em "Procura":**
- Criar um contacto novo do tipo `comprador` preenchendo "Preço máximo (€)" → confirmar que fica gravado em `people.details.looking_price`.
- Deixar o campo vazio → confirmar que fica `undefined`/ausente, sem erro.
- Abrir um contacto existente (criado antes desta funcionalidade, sem `looking_price`) → o campo aparece vazio/"—", sem quebrar a vista.
- Editar `looking_price` num contacto existente através do painel de detalhe → grava corretamente sem afetar os restantes campos de `details`.
