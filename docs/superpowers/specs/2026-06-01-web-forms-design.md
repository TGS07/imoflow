# Formulários Web — Design Spec

**Date:** 2026-06-01
**Status:** Approved
**Subsystem:** #7

---

## Overview

Formulários web públicos que as agências criam no backoffice e incorporam nos seus sites via `<iframe>`. Quando preenchidos, criam leads directamente no CRM com `source = 'site'`.

---

## Base de Dados

### Tabela `web_forms`

```sql
CREATE TABLE public.web_forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  fields      JSONB NOT NULL DEFAULT '["name","email","phone"]',
  stage_id    UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS:** `agency_id = public.get_my_agency_id()` para operações autenticadas. A leitura pública (para renderizar o form) usa uma policy separada que permite SELECT por `id` sem autenticação, apenas em formulários `is_active = true`.

**Campo `fields`:** array de strings com os campos visíveis. Valores possíveis: `name`, `email`, `phone`, `message`, `zone`, `typology`, `budget`. `name` e `email` são sempre obrigatórios independentemente do valor de `fields`.

---

## Campos do Formulário

| Campo | Label PT | Tipo HTML | Obrigatório |
|-------|----------|-----------|-------------|
| `name` | Nome completo | text | sempre |
| `email` | Email | email | sempre |
| `phone` | Telefone | tel | opcional |
| `message` | Mensagem | textarea | opcional |
| `zone` | Zona de interesse | text | opcional |
| `typology` | Tipologia | select (T0–T5+) | opcional |
| `budget` | Orçamento (€) | number | opcional |

---

## Arquitectura

### Páginas e Routes

| Ficheiro | Tipo | Responsabilidade |
|----------|------|-----------------|
| `app/(public)/f/[formId]/page.tsx` | Server component | Renderizar formulário público (sem layout da app) |
| `app/(public)/f/[formId]/FormClient.tsx` | Client component | Lógica de submissão e estado do form |
| `app/(public)/layout.tsx` | Layout | Layout standalone sem sidebar/header |
| `app/api/f/[formId]/route.ts` | Route handler | POST público — criar lead |
| `app/(app)/settings/forms/page.tsx` | Client component | Lista de formulários da agência |
| `app/(app)/settings/forms/new/page.tsx` | Client component | Criar novo formulário |
| `app/(app)/settings/forms/[id]/page.tsx` | Client component | Editar formulário |
| `app/api/forms/route.ts` | Route handler | GET list + POST create (autenticado) |
| `app/api/forms/[id]/route.ts` | Route handler | PATCH update + DELETE (autenticado) |

### API Pública: `POST /api/f/[formId]`

- Sem autenticação
- Verifica que o formulário existe e `is_active = true`
- Valida campos obrigatórios (`name`, `email`)
- Cria lead com:
  - `agency_id` do formulário
  - `source = 'site'`
  - `stage_id` do formulário (ou primeiro stage do pipeline se NULL)
  - campos preenchidos mapeados para colunas do lead
- Rate limiting: máximo 10 submissões por IP por hora (via headers, sem tabela extra)
- Resposta: `{ success: true }` ou `{ error: string }`

### API Autenticada

**`GET /api/forms`** — lista formulários da agência
**`POST /api/forms`** — criar formulário
**`PATCH /api/forms/[id]`** — editar formulário
**`DELETE /api/forms/[id]`** — eliminar formulário

### Formulário Público (`/f/[formId]`)

- Layout standalone (`app/(public)/layout.tsx`) — sem sidebar, header mínimo com logo texto "ImoFlow"
- Server component busca o formulário e passa ao client component
- Se formulário não encontrado ou inactivo: página 404 simples
- Após submissão com sucesso: mensagem "Obrigado! Entraremos em contacto em breve."
- Erros de validação: inline por campo
- Rate limit atingido: mensagem genérica de erro

### Snippet de Incorporação

```html
<iframe
  src="https://app.imoflow.pt/f/{formId}"
  width="100%"
  height="600"
  frameborder="0"
  style="border:none;border-radius:8px;">
</iframe>
```

O backoffice mostra este snippet num campo de texto copiável.

---

## Backoffice (`/settings/forms`)

- Lista com colunas: Nome, Campos activos, Stage destino, Estado (badge), Acções (editar, eliminar, copiar link)
- Botão "Novo formulário" → `/settings/forms/new`
- Formulário de criação/edição:
  - Nome (obrigatório)
  - Descrição (opcional)
  - Checkboxes para campos opcionais (name e email greyed out — sempre activos)
  - Select de stage de destino (lista stages da agência + opção "Primeiro stage")
  - Toggle activo/inactivo
- Link directo e snippet copiáveis na página de edição
- Link na sidebar: `{ href: '/settings/forms', icon: '📋', label: 'Formulários', section: 'Sistema' }`

---

## Rate Limiting

Sem tabela extra. Implementado via `X-Forwarded-For` + cache em memória no servidor (Map com TTL simples). Limite: 10 submissões por IP por 60 minutos. Em produção com Vercel Edge, isto é best-effort (sem persistência entre instâncias) — suficiente para bloquear submissões acidentais, não é um sistema anti-spam robusto.

---

## Out of Scope

- Campos personalizados (custom fields)
- Notificação por email ao submeter
- Múltiplos steps no formulário
- Captcha/recaptcha
- Webhook ao submeter
- Analytics de submissões
- Temas/cores personalizáveis
