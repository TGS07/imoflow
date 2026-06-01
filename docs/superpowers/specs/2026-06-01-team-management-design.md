# Gestão de Equipa — Design Spec

**Date:** 2026-06-01
**Status:** Approved
**Subsystem:** #8

---

## Overview

Permite ao admin de uma agência criar, listar, alterar o role e remover membros da equipa. Agentes têm visibilidade restrita aos seus próprios leads e não acedem a páginas de configuração.

---

## Base de Dados

Não são necessárias alterações de schema. A tabela `public.users` já possui:

```sql
role text not null default 'admin'  -- 'admin' | 'agent'
```

Sem nova migration.

---

## APIs

Todos os endpoints verificam `profile.role === 'admin'` — devolvem 403 se o utilizador for agente.

### `GET /api/team`
Lista todos os membros da agência (ordenados por `created_at ASC`).

Resposta:
```json
[{ "id": "uuid", "name": "...", "email": "...", "role": "admin|agent", "avatar_initials": "...", "created_at": "..." }]
```

### `POST /api/team`
Cria novo membro. Body:
```json
{ "name": "...", "email": "...", "password": "...", "role": "admin|agent" }
```
- Usa `supabase.auth.admin.createUser` (service role) com `email_confirm: true`
- Cria perfil em `public.users` com `agency_id` do admin autenticado
- Devolve `201` com o perfil criado
- Erros: 400 se campos em falta ou role inválido, 409 se email já existe

### `PATCH /api/team/[id]`
Altera role de um membro. Body:
```json
{ "role": "admin|agent" }
```
- Não permite alterar o próprio role (400)
- Valida que o membro pertence à mesma agência
- Devolve o perfil actualizado

### `DELETE /api/team/[id]`
Remove membro da equipa. Body:
```json
{ "reassign_to": "uuid | null" }
```
- Não permite remover a si próprio (400)
- Se `reassign_to` não for null: actualiza `leads.assigned_to = reassign_to` onde `assigned_to = id`
- Se `reassign_to` for null: só permitido se o membro não tem leads atribuídos (caso contrário 400)
- Remove o utilizador via `supabase.auth.admin.deleteUser` (service role)
- Devolve 204

---

## Restrições de Role

### Leads visíveis por agentes

Nos route handlers `GET /api/leads` e `GET /api/pipeline`, após buscar o perfil:

```typescript
if (profile.role === 'agent') {
  query = query.eq('assigned_to', profile.id)
}
```

### Acesso a settings

No layout `app/(app)/layout.tsx`: se `profile.role === 'agent'` e o pathname começa por `/settings`, redirecionar para `/dashboard`.

### Sidebar

O array `navItems` em `Sidebar.tsx` recebe o `userRole` como prop. Os itens da secção Sistema (`/settings/*`) só são renderizados se `userRole === 'admin'`.

### APIs de settings

Adicionar verificação `role === 'admin'` (403 se agente) nos handlers:
- `POST /api/forms`, `PATCH /api/forms/[id]`, `DELETE /api/forms/[id]`
- `POST /api/automations`, `PATCH /api/automations/[id]`, `DELETE /api/automations/[id]`

(Os endpoints de pipeline-stages e custom-fields já têm este check.)

---

## Páginas e Routes

| Ficheiro | Tipo | Responsabilidade |
|----------|------|-----------------|
| `app/(app)/settings/team/page.tsx` | Client component | Lista de membros com acções |
| `app/(app)/settings/team/new/page.tsx` | Client component | Formulário criar membro |
| `app/api/team/route.ts` | Route handler | GET list + POST create |
| `app/api/team/[id]/route.ts` | Route handler | PATCH role + DELETE |

---

## Backoffice (`/settings/team`)

### Lista de membros
- Colunas: Avatar (iniciais), Nome, Email, Role (badge "Admin" / "Agente"), Data de entrada
- Acções por linha: select de role (Admin/Agente) com submit automático ao mudar, botão Remover
- Botão "Adicionar membro" → `/settings/team/new`
- O próprio admin não tem acções disponíveis na sua linha (não pode alterar o próprio role nem remover-se)

### Criar membro (`/settings/team/new`)
- Campos: Nome (obrigatório), Email (obrigatório), Password (obrigatório, mínimo 8 caracteres), Role (select: Admin / Agente, default Agente)
- Após sucesso: redireciona para `/settings/team`

### Modal de remoção
- Aparece ao clicar "Remover"
- Se o membro tem leads: mostra select "Reatribuir leads para:" com lista de outros membros activos
- Se o membro não tem leads: mostra apenas confirmação simples
- Botão "Confirmar remoção" envia DELETE com `reassign_to`

### Sidebar
```typescript
{ href: '/settings/team', icon: '👥', label: 'Equipa', section: 'Sistema' }
```
Visível apenas quando `userRole === 'admin'`.

---

## Out of Scope

- Convite por email
- Permissões granulares (além de admin/agent)
- Histórico de acções da equipa
- Limite de membros por plano
- Agentes verem leads não atribuídos (pool de leads)
