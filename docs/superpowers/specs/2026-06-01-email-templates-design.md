# Templates de Email — Design Spec

**Date:** 2026-06-01
**Status:** Approved
**Subsystem:** #9

---

## Overview

Permite ao admin criar, editar e apagar templates de email reutilizáveis. No modal de envio de email, o agente pode seleccionar um template para pré-preencher assunto e corpo, editando antes de enviar.

---

## Base de Dados

Nova migration:

```sql
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

create policy "agency members can manage their templates"
  on public.email_templates
  for all
  using (agency_id = get_my_agency_id())
  with check (agency_id = get_my_agency_id());
```

---

## APIs

Todos os endpoints de escrita verificam `profile.role === 'admin'` — devolvem 403 se agente. GET é acessível a todos os membros da agência.

### `GET /api/email-templates`
Lista todos os templates da agência (ordenados por `created_at ASC`).

Resposta:
```json
[{ "id": "uuid", "name": "...", "subject": "...", "body": "...", "created_at": "..." }]
```

### `POST /api/email-templates`
Cria novo template. Body:
```json
{ "name": "...", "subject": "...", "body": "..." }
```
- Todos os campos são obrigatórios
- Devolve `201` com o template criado

### `PATCH /api/email-templates/[id]`
Actualiza template. Body (campos opcionais):
```json
{ "name": "...", "subject": "...", "body": "..." }
```
- Valida que pertence à agência
- Devolve o template actualizado

### `DELETE /api/email-templates/[id]`
Remove template.
- Valida que pertence à agência
- Devolve 204

---

## Páginas e Routes

| Ficheiro | Tipo | Responsabilidade |
|----------|------|-----------------|
| `app/(app)/settings/templates/page.tsx` | Client component | Lista de templates com acções |
| `app/(app)/settings/templates/new/page.tsx` | Client component | Formulário criar template |
| `app/(app)/settings/templates/[id]/page.tsx` | Client component | Formulário editar template |
| `app/api/email-templates/route.ts` | Route handler | GET list + POST create |
| `app/api/email-templates/[id]/route.ts` | Route handler | PATCH update + DELETE |

---

## Backoffice (`/settings/templates`)

### Lista de templates
- Cards com: nome (título), preview do assunto (subtítulo), botões Editar e Eliminar
- Botão "Novo template" → `/settings/templates/new`
- Confirmar antes de eliminar

### Criar/Editar template
- Campos: Nome (obrigatório), Assunto (obrigatório), Corpo (textarea obrigatório)
- Após sucesso: redireciona para `/settings/templates`

### Sidebar
```typescript
{ href: '/settings/templates', icon: '✉', label: 'Templates Email', section: 'Sistema' }
```
Visível apenas quando `userRole === 'admin'`.

---

## Integração no Modal de Envio

No componente existente `SendEmailModal.tsx`:

- Adicionar select "Usar template" no topo do modal (lista os templates da agência via `GET /api/email-templates`)
- Ao seleccionar um template: preenche os campos `subject` e `body` com os valores do template
- Os campos ficam editáveis — o agente pode ajustar antes de enviar
- Opção neutra "Nenhum" (valor vazio) no topo do select, não altera campos

---

## Out of Scope

- Variáveis/placeholders nos templates (e.g. `{{lead.name}}`)
- Histórico de utilização de templates
- Templates globais partilhados entre agências
- Pré-visualização de email antes de enviar
