# Atividades & Calendário — Design Spec

**Data:** 2026-05-30
**Status:** Aprovado
**Subsistema:** #4 do roadmap ImoFlow → Pipedrive Killer

---

## 1. Objetivo

Unificar contactos e tarefas numa entidade "Atividade" com calendário integrado. Cada atividade tem tipo, data/hora, estado, e pode estar associada a um lead e/ou pessoa. Substitui as secções separadas de contactos e tarefas no lead detail.

---

## 2. Tabela `activities`

```sql
CREATE TABLE public.activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  person_id     UUID REFERENCES people(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES users(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('chamada','visita','email','reuniao','tarefa','nota')),
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  completed     BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX activities_agency_idx ON activities(agency_id);
CREATE INDEX activities_lead_idx ON activities(lead_id);
CREATE INDEX activities_due_idx ON activities(agency_id, due_date);
CREATE INDEX activities_assigned_idx ON activities(assigned_to, completed);
```

**RLS:** Utilizadores só veem atividades da sua agência.

---

## 3. Migração de Dados

### contacts → activities
```sql
INSERT INTO activities (agency_id, lead_id, assigned_to, type, title, description, due_date, completed, created_at)
SELECT l.agency_id, c.lead_id, c.user_id, c.type, c.title, c.description, c.created_at, true, c.created_at
FROM contacts c
JOIN leads l ON l.id = c.lead_id;
```

### tasks → activities
```sql
INSERT INTO activities (agency_id, lead_id, assigned_to, type, title, due_date, completed, completed_at, created_at)
SELECT l.agency_id, t.lead_id, t.assigned_to, 'tarefa', t.title, t.due_date::timestamptz, t.completed,
  CASE WHEN t.completed THEN t.created_at END, t.created_at
FROM tasks t
JOIN leads l ON l.id = t.lead_id;
```

### Decisão: manter tabelas antigas

As tabelas `contacts` e `tasks` mantêm-se nesta fase por retrocompatibilidade. As APIs antigas continuam a funcionar, mas novas funcionalidades usam `activities`. Remoção prevista em subsistema futuro.

---

## 4. Páginas

### `/activities` — Calendário & Lista

- **Vista mensal** — grelha com dias, cada dia mostra badges de atividades (cor por tipo).
- **Vista semanal** — mais detalhe, mostra título e hora.
- **Lista de pendentes** — painel lateral com atividades não concluídas, ordenadas por due_date.
- Clicar numa atividade abre modal de detalhe/edição.
- Botão "+ Nova Atividade".
- Filtros: tipo (select), agente (select), lead (search).

### Cores por tipo
| Tipo     | Cor      |
|----------|----------|
| chamada  | #3B82F6  |
| visita   | #F59E0B  |
| email    | #8B5CF6  |
| reuniao  | #10B981  |
| tarefa   | #EF4444  |
| nota     | #6B7280  |

---

## 5. API Endpoints

### Activities
- `GET /api/activities` — lista com filtros: lead_id, person_id, type, assigned_to, completed, date_from, date_to
- `POST /api/activities` — criar atividade
- `GET /api/activities/[id]` — detalhe
- `PATCH /api/activities/[id]` — editar/completar (ao marcar completed=true, set completed_at=now())
- `DELETE /api/activities/[id]` — eliminar

---

## 6. Alterações em Componentes Existentes

### Lead Detail Page (`/leads/[id]`)
- Remover secções separadas de "Contactos" e "Tarefas".
- Nova secção unificada "Atividades" — lista de atividades do lead com:
  - Filtro por tipo (tabs: Todas, Chamadas, Visitas, etc.)
  - Badge de cor por tipo
  - Checkbox para marcar como concluída
  - Formulário inline para adicionar nova atividade
- Manter a funcionalidade de email (SendEmailModal) como está.

### Sidebar
- Novo link: "Atividades" na secção "Principal".

### Dashboard
- Novo widget: "Atividades de Hoje" — lista das atividades com due_date = hoje, ordenadas por hora.
- Contador no KPI bar: "X atividades pendentes".

---

## 7. Types Novos

```typescript
export type ActivityType = 'chamada' | 'visita' | 'email' | 'reuniao' | 'tarefa' | 'nota'

export type Activity = {
  id: string
  agency_id: string
  lead_id: string | null
  person_id: string | null
  assigned_to: string | null
  type: ActivityType
  title: string
  description: string | null
  due_date: string | null
  end_date: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  users?: { name: string; avatar_initials: string }
  leads?: { id: string; name: string }
  people?: { id: string; name: string }
}
```

---

## 8. Fora de Escopo

- Notificações push/email para atividades próximas (subsistema #5 — Automações).
- Sincronização com Google Calendar (subsistema #10 — Integrações).
- Atividades recorrentes (futuro).
- Remoção das tabelas `contacts` e `tasks` (futuro, quando todas as referências forem migradas).
