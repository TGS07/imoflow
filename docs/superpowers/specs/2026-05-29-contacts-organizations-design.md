# Gestão de Contactos/Organizações — Design Spec

**Data:** 2026-05-29
**Status:** Aprovado
**Subsistema:** #2 do roadmap ImoFlow → Pipedrive Killer

---

## 1. Objetivo

Separar a entidade "Pessoa" (contacto) da entidade "Lead/Negócio", permitindo que uma pessoa tenha múltiplos negócios ao longo do tempo. Adicionar entidade "Organização" para empresas/construtoras.

---

## 2. Tabela `people`

```sql
CREATE TABLE public.people (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX people_agency_idx ON people(agency_id);
```

**RLS:** Utilizadores só veem pessoas da sua agência.

---

## 3. Tabela `organizations`

```sql
CREATE TABLE public.organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  website    TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX organizations_agency_idx ON organizations(agency_id);
```

**RLS:** Utilizadores só veem organizações da sua agência.

---

## 4. Alterações na tabela `leads`

```sql
ALTER TABLE public.leads ADD COLUMN person_id UUID REFERENCES public.people(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
```

### Migração de dados

1. Para cada lead existente, criar uma entrada em `people` com o `name`, `email`, `phone` do lead.
2. Associar o lead à pessoa criada via `person_id`.
3. O campo `name` do lead mantém-se (funciona como nome do negócio).
4. Os campos `email` e `phone` mantêm-se no lead para retrocompatibilidade (não remover nesta fase).

### Decisão: manter email/phone nos leads

Remover email/phone dos leads seria uma migração destrutiva que afeta muitos componentes. Em vez disso:
- Leads mantêm `email` e `phone` como campos opcionais.
- A pessoa (`people`) é a fonte de verdade para contacto.
- O lead detail mostra os dados da pessoa associada.
- Gradualmente, os novos leads usarão `person_id` em vez de email/phone diretos.

---

## 5. Páginas Novas

### `/people` — Lista de Pessoas
- Tabela com: nome, email, telefone, nº de negócios, data de criação.
- Pesquisa por nome, email, telefone.
- Clicar numa pessoa abre `/people/[id]`.
- Botão "+ Nova Pessoa".

### `/people/[id]` — Detalhe da Pessoa
- Info da pessoa: nome, email, telefone, morada, notas (editável inline).
- Lista de negócios/leads associados (com stage, valor, data).
- Histórico de contactos agregado de todos os negócios desta pessoa.
- Botão "Novo Negócio" que cria um lead pré-associado a esta pessoa.

### `/organizations` — Lista de Organizações
- Tabela com: nome, email, telefone, website, nº de negócios.
- Pesquisa por nome.
- Botão "+ Nova Organização".

### `/organizations/[id]` — Detalhe da Organização
- Info da organização (editável inline).
- Lista de negócios associados.
- Lista de pessoas que fizeram negócios com esta organização.

---

## 6. API Endpoints

### People
- `GET /api/people` — lista pessoas (search param: `search`)
- `POST /api/people` — criar pessoa
- `GET /api/people/[id]` — detalhe com leads associados
- `PATCH /api/people/[id]` — editar pessoa
- `DELETE /api/people/[id]` — eliminar pessoa

### Organizations
- `GET /api/organizations` — lista organizações (search param: `search`)
- `POST /api/organizations` — criar organização
- `GET /api/organizations/[id]` — detalhe com leads associados
- `PATCH /api/organizations/[id]` — editar organização
- `DELETE /api/organizations/[id]` — eliminar organização

### Leads (alterações)
- `POST /api/leads` — aceita `person_id` e `organization_id`
- `PATCH /api/leads/[id]` — aceita `person_id` e `organization_id`
- `GET /api/leads` e `GET /api/leads/[id]` — inclui join com `people` e `organizations`

---

## 7. Alterações em Componentes Existentes

### Sidebar
- Novos links: "Pessoas" e "Organizações" na secção "Principal".

### NewLeadModal
- Campo de pessoa: autocomplete que pesquisa em `/api/people?search=...`.
- Se a pessoa não existe, opção "Criar nova pessoa" inline.
- Campo opcional de organização: autocomplete similar.

### KanbanBoard — LeadCard
- Mostrar nome da pessoa abaixo do nome do negócio.

### Lead Detail Page
- Secção com link para a pessoa associada.
- Se tem organização, mostrar badge/link.

### Dashboard
- Sem alterações necessárias nesta fase.

---

## 8. Types Novos

```typescript
export type Person = {
  id: string
  agency_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export type Organization = {
  id: string
  agency_id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  created_at: string
}
```

Lead type atualizado:
```typescript
export type Lead = {
  // ... campos existentes ...
  person_id: string | null
  organization_id: string | null
  people?: Person
  organizations?: Organization
}
```

---

## 9. Fora de Escopo

- Merge/dedup de pessoas duplicadas (subsistema futuro).
- Importação em massa de contactos (subsistema #10).
- Relações pessoa ↔ organização (simplificação: a relação é via lead).
