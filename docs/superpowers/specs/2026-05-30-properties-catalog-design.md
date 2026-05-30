# Catálogo de Imóveis — Design Spec

**Data:** 2026-05-30
**Status:** Aprovado
**Subsistema:** #3 do roadmap ImoFlow → Pipedrive Killer

---

## 1. Objetivo

Criar um catálogo de imóveis independente dos leads, onde cada imóvel pode estar associado a múltiplos negócios/leads. A agência gere o seu portefólio de imóveis e associa clientes interessados a cada propriedade.

---

## 2. Tabela `properties`

```sql
CREATE TABLE public.properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  reference   TEXT,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('apartamento','moradia','terreno','loja','escritorio','armazem','outro')),
  status      TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','reservado','vendido','arrendado')),
  price       NUMERIC,
  area_m2     NUMERIC,
  typology    TEXT,
  bedrooms    INT,
  bathrooms   INT,
  floor       TEXT,
  condition   TEXT CHECK (condition IN ('novo','usado','renovado','em_construcao')),
  address     TEXT,
  city        TEXT,
  zone        TEXT,
  postal_code TEXT,
  latitude    NUMERIC,
  longitude   NUMERIC,
  description TEXT,
  features    JSONB DEFAULT '[]',
  photos      JSONB DEFAULT '[]',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX properties_agency_idx ON properties(agency_id);
CREATE INDEX properties_status_idx ON properties(agency_id, status);
```

**RLS:** Utilizadores só veem imóveis da sua agência.

---

## 3. Alterações na tabela `leads`

```sql
ALTER TABLE public.leads ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;
```

### Decisão: manter zone/typology/budget nos leads

Os campos `zone`, `typology` e `budget` nos leads representam a **preferência do cliente**, não o imóvel em si. Mantêm-se como estão. O `property_id` liga o lead ao imóvel concreto do negócio.

---

## 4. Páginas Novas

### `/properties` — Lista de Imóveis

- Tabela com: referência, título, tipo, tipologia, preço, área, status, zona.
- Filtros: tipo (select), status (select), zona (texto), preço mín/máx (number).
- Pesquisa por título, referência, morada.
- Botão "+ Novo Imóvel".
- Clicar num imóvel abre `/properties/[id]`.

### `/properties/[id]` — Detalhe do Imóvel

- Info completa do imóvel (editável inline).
- Galeria de fotos (URLs — sem upload nesta fase, o utilizador cola URLs).
- Lista de características/features (tags editáveis).
- Lista de leads/negócios associados a este imóvel (com stage, pessoa, valor).
- Botão "Novo Negócio" que cria um lead pré-associado a este imóvel.

---

## 5. API Endpoints

### Properties
- `GET /api/properties` — lista imóveis (search, filtros: type, status, zone, price_min, price_max)
- `POST /api/properties` — criar imóvel
- `GET /api/properties/[id]` — detalhe com leads associados
- `PATCH /api/properties/[id]` — editar imóvel
- `DELETE /api/properties/[id]` — eliminar imóvel

### Leads (alterações)
- `POST /api/leads` — aceita `property_id`
- `PATCH /api/leads/[id]` — aceita `property_id`
- `GET /api/leads` e `GET /api/leads/[id]` — inclui join com `properties`

---

## 6. Alterações em Componentes Existentes

### Sidebar
- Novo link: "Imóveis" na secção "Principal".

### NewLeadModal
- Campo de imóvel: autocomplete que pesquisa em `/api/properties?search=...`.
- Mostra referência + título + preço nos resultados.

### KanbanBoard — LeadCard
- Mostrar referência/título do imóvel abaixo do nome da pessoa (se existir).

### Lead Detail Page
- Badge clicável com link para `/properties/[property_id]`.

### Dashboard
- Sem alterações nesta fase.

---

## 7. Types Novos

```typescript
export type PropertyType = 'apartamento' | 'moradia' | 'terreno' | 'loja' | 'escritorio' | 'armazem' | 'outro'
export type PropertyStatus = 'disponivel' | 'reservado' | 'vendido' | 'arrendado'
export type PropertyCondition = 'novo' | 'usado' | 'renovado' | 'em_construcao'

export type Property = {
  id: string
  agency_id: string
  reference: string | null
  title: string
  type: PropertyType
  status: PropertyStatus
  price: number | null
  area_m2: number | null
  typology: string | null
  bedrooms: number | null
  bathrooms: number | null
  floor: string | null
  condition: PropertyCondition | null
  address: string | null
  city: string | null
  zone: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
  features: string[]
  photos: string[]
  notes: string | null
  created_at: string
}
```

Lead type atualizado:
```typescript
export type Lead = {
  // ... campos existentes ...
  property_id: string | null
  properties?: Property
}
```

---

## 8. Fora de Escopo

- Upload de fotos para Supabase Storage (nesta fase, o utilizador cola URLs manualmente).
- Mapa interativo com localização dos imóveis (subsistema futuro).
- Publicação automática em portais imobiliários (subsistema futuro).
- Matching automático imóvel-cliente por preferências (subsistema futuro).
