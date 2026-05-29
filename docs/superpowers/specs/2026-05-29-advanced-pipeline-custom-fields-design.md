# Pipeline Avançado + Campos Personalizados — Design Spec

**Data:** 2026-05-29
**Status:** Aprovado
**Subsistema:** #1 do roadmap ImoFlow → Pipedrive Killer

---

## 1. Objetivo

Transformar o pipeline hardcoded de 5 etapas num sistema flexível onde cada agência personaliza as suas etapas, cria campos custom nos leads, e tem visibilidade sobre valores de negócio e previsões de receita.

---

## 2. Etapas Personalizáveis do Pipeline

### 2.1 Tabela `pipeline_stages`

```sql
CREATE TABLE pipeline_stages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6B7280',
  position   INT NOT NULL DEFAULT 0,
  probability INT NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  is_won     BOOLEAN NOT NULL DEFAULT false,
  is_lost    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pipeline_stages_agency_idx ON pipeline_stages(agency_id, position);
```

**RLS:** Utilizadores só veem etapas da sua agência.

### 2.2 Etapas Default

Ao criar uma agência (via admin), criar automaticamente:

| position | name        | color   | probability | is_won | is_lost |
|----------|-------------|---------|-------------|--------|---------|
| 0        | Lead        | #3B82F6 | 10          | false  | false   |
| 1        | Visita      | #F59E0B | 30          | false  | false   |
| 2        | Proposta    | #8B5CF6 | 50          | false  | false   |
| 3        | Negociação  | #F97316 | 70          | false  | false   |
| 4        | Fechado     | #10B981 | 100         | true   | false   |
| 5        | Perdido     | #EF4444 | 0           | false  | true    |

### 2.3 Migração do campo `stage` nos leads

- Adicionar coluna `stage_id UUID REFERENCES pipeline_stages(id)`.
- Migração: para cada agência, criar as etapas default e mapear os leads existentes (pelo nome da etapa) para o `stage_id` correspondente.
- Remover a coluna `stage` (enum) depois de migrados.
- Atualizar o type `LeadStage` para ser dinâmico (vem da DB).

### 2.4 Regras de Negócio

- Cada agência deve ter pelo menos 1 etapa.
- Só pode existir 1 etapa `is_won` e 1 etapa `is_lost` por agência.
- A etapa `is_lost` não aparece como coluna no Kanban — leads perdidos vão para um "arquivo".
- Reordenar etapas atualiza o campo `position` de todas as etapas da agência.

---

## 3. Campos Personalizados

### 3.1 Tabela `custom_fields`

```sql
CREATE TABLE custom_fields (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','number','date','select','multiselect','boolean','currency')),
  options    JSONB,          -- para select/multiselect: ["opção1","opção2"]
  required   BOOLEAN NOT NULL DEFAULT false,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX custom_fields_agency_idx ON custom_fields(agency_id, position);
```

### 3.2 Tabela `custom_field_values`

```sql
CREATE TABLE custom_field_values (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_id     UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value_text   TEXT,
  value_number NUMERIC,
  value_date   DATE,
  value_json   JSONB,          -- para multiselect
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, field_id)
);

CREATE INDEX custom_field_values_lead_idx ON custom_field_values(lead_id);
```

### 3.3 Lógica de Armazenamento por Tipo

| field_type  | Coluna usada   |
|-------------|----------------|
| text        | value_text     |
| number      | value_number   |
| date        | value_date     |
| select      | value_text     |
| multiselect | value_json     |
| boolean     | value_text     |
| currency    | value_number   |

### 3.4 Regras de Negócio

- Campos custom aparecem no formulário de criação/edição de lead, abaixo dos campos nativos.
- Campos `required` bloqueiam submissão se vazios.
- Ao eliminar um custom_field, os valores associados são eliminados em cascata.
- Limite: 30 campos personalizados por agência (plano free), ilimitados no pro.

---

## 4. Valores de Negócio e Previsões

### 4.1 Novos Campos no Lead

```sql
ALTER TABLE leads ADD COLUMN deal_value NUMERIC;
ALTER TABLE leads ADD COLUMN expected_close_date DATE;
```

### 4.2 Cálculos (frontend)

- **Valor ponderado** = `deal_value × (probabilidade da etapa / 100)`
- **Pipeline total** = soma de `deal_value` de todos os leads ativos
- **Pipeline ponderado** = soma dos valores ponderados
- **Previsão mensal** = soma de valores ponderados dos leads com `expected_close_date` no mês corrente

### 4.3 Dashboard KPIs Novos

- Valor total do pipeline
- Valor ponderado do pipeline
- Previsão de receita este mês
- Taxa de conversão (leads won / total leads fechados)
- Tempo médio de fecho (dias entre criação e won)

---

## 5. Pipeline/Kanban Melhorado

### 5.1 Kanban

- Colunas dinâmicas baseadas em `pipeline_stages` (ordenadas por `position`).
- Cada coluna mostra: nome da etapa, contagem de leads, soma de `deal_value`.
- Etapa `is_lost` não aparece como coluna — botão separado "Marcar como perdido".
- Cards mostram: nome, deal_value (se existir), expected_close_date, agente atribuído.
- Indicador de "stale deal": ponto vermelho se não houver atividade (contacto) nos últimos 7 dias.

### 5.2 Filtros e Ordenação

- Filtrar por: agente atribuído, intervalo de valor, intervalo de data de fecho, campos custom (select).
- Ordenar dentro de cada coluna: por valor (desc), data de criação, nome.
- Os filtros persistem na URL (query params) para partilha.

---

## 6. Página de Configurações `/settings/pipeline`

### 6.1 Secção: Etapas do Pipeline

- Lista de etapas com drag-and-drop para reordenar.
- Editar inline: nome, cor (color picker), probabilidade (slider 0-100).
- Botão "+ Adicionar etapa" — insere no final.
- Botão de eliminar por etapa (com confirmação — leads nessa etapa movidos para a primeira etapa).
- Badges "Won" e "Lost" nas etapas marcadas.

### 6.2 Secção: Campos Personalizados

- Lista de campos com drag-and-drop para reordenar.
- Criar campo: nome, tipo, opções (se select/multiselect), obrigatório.
- Editar campo inline.
- Eliminar campo (com confirmação — valores eliminados em cascata).

---

## 7. API Endpoints Novos

### Pipeline Stages
- `GET /api/pipeline-stages` — lista etapas da agência do utilizador
- `POST /api/pipeline-stages` — criar etapa
- `PATCH /api/pipeline-stages/[id]` — editar etapa
- `DELETE /api/pipeline-stages/[id]` — eliminar etapa (move leads para etapa default)
- `PATCH /api/pipeline-stages/reorder` — reordenar (body: `{stages: [{id, position}]}`)

### Custom Fields
- `GET /api/custom-fields` — lista campos da agência
- `POST /api/custom-fields` — criar campo
- `PATCH /api/custom-fields/[id]` — editar campo
- `DELETE /api/custom-fields/[id]` — eliminar campo

### Custom Field Values (integrados nos leads)
- `GET /api/leads/[id]` — já retorna os custom field values junto com o lead
- `PATCH /api/leads/[id]` — aceita `custom_fields: {field_id: value}` no body

---

## 8. Alterações em Código Existente

### Types (types/index.ts)
- Novo type `PipelineStage`
- Novo type `CustomField`
- Novo type `CustomFieldValue`
- Lead type: remover `stage` enum, adicionar `stage_id`, `deal_value`, `expected_close_date`, `stage?: PipelineStage`, `custom_field_values?: CustomFieldValue[]`

### Componentes Afetados
- `KanbanBoard.tsx` — colunas dinâmicas, valores por coluna, filtros
- `NewLeadModal.tsx` — campos custom, deal_value, expected_close_date
- `Sidebar.tsx` — novo link "Configurações"
- Dashboard page — novos KPIs

### API Routes Afetadas
- `POST /api/leads` — suportar stage_id, deal_value, expected_close_date, custom fields
- `PATCH /api/leads/[id]` — idem
- `GET /api/leads` — incluir stage info e custom field values
- `GET /api/leads/[id]` — incluir custom field values
- `POST /api/admin/agencies` — criar pipeline_stages default

### Migrações
1. Criar tabelas: `pipeline_stages`, `custom_fields`, `custom_field_values`
2. Inserir etapas default para agências existentes
3. Adicionar `stage_id`, `deal_value`, `expected_close_date` aos leads
4. Migrar dados: mapear `stage` enum → `stage_id`
5. Remover coluna `stage` e o type enum
6. RLS policies nas 3 novas tabelas

---

## 9. Fora de Escopo (para subsistemas futuros)

- Múltiplos pipelines por agência
- Automações baseadas em mudança de etapa (subsistema #5)
- Relatórios avançados de pipeline (subsistema #6)
- Importação de leads em massa (subsistema #10)
