# Redesign + Automações Email + WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emails automáticos nas automações (com templates e variáveis), construtor de regras na UI, respostas rápidas WhatsApp + Business API preparada, e redesenho visual com animações.

**Architecture:** Expandir o motor de automações existente (`lib/automations/engine.ts`) com ações `send_email`/`send_whatsapp` e suporte a service client (corrige bug: em cron sem sessão o RLS bloqueia tudo). Extrair envio de email para `lib/email/` partilhado com substituição de variáveis. WhatsApp em duas camadas: `wa.me` deep links (imediato) e webhook + Meta Cloud API (opcional, atrás de env vars). Design system com classes utilitárias em `globals.css` substituindo estilos inline.

**Tech Stack:** Next.js 16 App Router, Supabase (RLS + service role), Resend, Meta WhatsApp Cloud API, CSS puro (sem novas dependências)

---

## File Structure

**Novos ficheiros:**
- `supabase/migrations/20260611_whatsapp_and_agency_email.sql` — whatsapp_templates, whatsapp_messages, colunas de remetente em agencies
- `types/whatsapp.ts` — tipos WhatsApp
- `lib/email/variables.ts` — substituição de `{{variáveis}}`
- `lib/email/send.ts` — envio partilhado (manual + automações) com remetente por agência
- `lib/whatsapp/send.ts` — envio via Meta Cloud API (Business API)
- `lib/whatsapp/utils.ts` — normalização de números + link wa.me
- `app/api/whatsapp-templates/route.ts` + `[id]/route.ts` — CRUD templates WhatsApp
- `app/api/agency/route.ts` — GET/PATCH definições da agência (remetente)
- `app/api/whatsapp/webhook/route.ts` — webhook Meta (GET verify + POST receive)
- `app/(app)/settings/agency/page.tsx` — definições de envio da agência
- `components/automations/RuleFormModal.tsx` — construtor de regras
- `components/leads/WhatsAppModal.tsx` — resposta rápida WhatsApp
- `components/ui/Icon.tsx` — ícones SVG
- `docs/WHATSAPP_SETUP.md` — guia Business API

**Ficheiros modificados:**
- `types/automation.ts` — novos action/trigger types
- `lib/automations/engine.ts` — novas ações + client injetável
- `app/api/emails/send/route.ts` — usar lib/email/send + variáveis
- `app/api/cron/lead-inactive/route.ts` — service client
- `vercel.json` — cron lead-inactive
- `app/(app)/settings/automations/page.tsx` — CRUD de regras
- `app/(app)/settings/templates/page.tsx` — separadores Email | WhatsApp
- `app/(app)/leads/[id]/page.tsx` — botão WhatsApp
- `components/layout/Sidebar.tsx` — ícones SVG + link agência
- `app/globals.css` — design system + animações
- Páginas principais — aplicar classes do design system

---

### Task 1: Migração BD + tipos

**Files:**
- Create: `supabase/migrations/20260611_whatsapp_and_agency_email.sql`
- Create: `types/whatsapp.ts`
- Modify: `types/automation.ts`, `types/index.ts`

- [ ] **Step 1: Criar migração**

```sql
-- Remetente de email por agência
ALTER TABLE public.agencies
  ADD COLUMN email_from_name TEXT,
  ADD COLUMN email_reply_to TEXT;

-- Templates WhatsApp (espelha email_templates)
CREATE TABLE public.whatsapp_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_templates_agency_idx ON public.whatsapp_templates(agency_id);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_templates: own agency" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (agency_id = public.get_my_agency_id())
  WITH CHECK (agency_id = public.get_my_agency_id());

-- Mensagens WhatsApp (Business API; inbound + outbound)
CREATE TABLE public.whatsapp_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID        REFERENCES public.agencies(id) ON DELETE CASCADE,
  lead_id     UUID        REFERENCES public.leads(id) ON DELETE CASCADE,
  direction   TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
  phone       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  wa_message_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_messages_lead_idx ON public.whatsapp_messages(lead_id);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_messages: own agency" ON public.whatsapp_messages
  FOR ALL TO authenticated
  USING (agency_id = public.get_my_agency_id());

-- Política de UPDATE em agencies para admins (remetente)
CREATE POLICY "agencies: admin update own" ON public.agencies
  FOR UPDATE TO authenticated
  USING (id = public.get_my_agency_id())
  WITH CHECK (id = public.get_my_agency_id());
```

- [ ] **Step 2: Aplicar migração no Supabase** (MCP `apply_migration` ou dashboard)

- [ ] **Step 3: Atualizar tipos** — `types/automation.ts`: `AutomationActionType` += `'send_email' | 'send_whatsapp'`; `AutomationTriggerType` += `'whatsapp_message_received'`; `AutomationEvent.meta` += `messageBody?: string`. Criar `types/whatsapp.ts` com `WhatsAppTemplate` e re-exportar em `types/index.ts`.

- [ ] **Step 4: Commit**

---

### Task 2: lib/email — variáveis + envio partilhado

**Files:**
- Create: `lib/email/variables.ts`, `lib/email/send.ts`
- Modify: `app/api/emails/send/route.ts`

- [ ] **Step 1: `lib/email/variables.ts`**

```typescript
export type TemplateVars = {
  nome?: string | null
  email?: string | null
  telefone?: string | null
  agente?: string | null
  agencia?: string | null
}

export function fillVariables(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key as keyof TemplateVars]
    return value != null && value !== '' ? String(value) : match
  })
}
```

- [ ] **Step 2: `lib/email/send.ts`** — `sendLeadEmail({ supabase, leadId, toEmail, subject, body, sentBy, agencyId })`: lê `agencies.name/email_from_name/email_reply_to`, envia via Resend com `from: "<fromName> <EMAIL_FROM (default onboarding@resend.dev)>"` e `replyTo` quando definido, regista em `emails_sent` + `contacts`. Aceita qualquer SupabaseClient (sessão ou service).

- [ ] **Step 3: Refatorar `/api/emails/send`** para usar `sendLeadEmail` + `fillVariables` com dados da lead/agente.

- [ ] **Step 4: Commit**

---

### Task 3: Motor — ações send_email/send_whatsapp + client injetável

**Files:**
- Modify: `lib/automations/engine.ts`, `app/api/cron/lead-inactive/route.ts`
- Create: `lib/whatsapp/send.ts`

- [ ] **Step 1:** `triggerAutomations(event, client?)` — usa client passado ou cria o de sessão. Cron `lead-inactive` passa `createServiceClient()` (corrige RLS em cron; usar também o service client nas queries do próprio cron).
- [ ] **Step 2:** ação `send_email`: carrega template (`action_config.template_id`), lead (nome/email/telefone), agente, agência; `fillVariables`; `sendLeadEmail`. Lead sem email → throw para o log marcar failed.
- [ ] **Step 3:** `lib/whatsapp/send.ts` — `sendWhatsAppMessage(phone, body)` via `https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages`; `isWhatsAppConfigured()`. Ação `send_whatsapp` no motor (template WhatsApp + variáveis), regista em `whatsapp_messages`.
- [ ] **Step 4:** `vercel.json` += cron `/api/cron/lead-inactive` `0 9 * * *`.
- [ ] **Step 5: Commit**

---

### Task 4: APIs — whatsapp-templates + agency

**Files:**
- Create: `app/api/whatsapp-templates/route.ts`, `app/api/whatsapp-templates/[id]/route.ts`, `app/api/agency/route.ts`

- [ ] **Step 1:** CRUD whatsapp-templates espelhando `app/api/email-templates/*` (GET aberto a autenticados, escrita admin-only, validação name/body).
- [ ] **Step 2:** `app/api/agency/route.ts` — GET (name, email, email_from_name, email_reply_to) + PATCH (admin) dos dois últimos.
- [ ] **Step 3: Commit**

---

### Task 5: UI — construtor de regras de automação

**Files:**
- Create: `components/automations/RuleFormModal.tsx`
- Modify: `app/(app)/settings/automations/page.tsx`

- [ ] **Step 1:** `RuleFormModal` — formulário "Quando … → Então …": nome, descrição, trigger (select com config contextual: stage destino para `stage_changed`, dias para `lead_inactive`), ação (select com config contextual: template para `send_email`/`send_whatsapp`, tipo+título+prazo para `create_activity`, mensagem para `send_notification`, stage para `move_stage`). Carrega stages de `/api/pipeline-stages`, templates de `/api/email-templates` e `/api/whatsapp-templates`. POST/PATCH `/api/automations`.
- [ ] **Step 2:** Página de automações: botão "Nova regra", editar, apagar (com confirmação), labels para os novos tipos, aviso "WhatsApp não configurado" quando ação `send_whatsapp` sem env vars (flag exposta via GET `/api/automations` ou endpoint de config).
- [ ] **Step 3: Commit**

---

### Task 6: UI — templates WhatsApp (separador)

**Files:**
- Modify: `app/(app)/settings/templates/page.tsx` (+ páginas new/[id] ou modal)

- [ ] **Step 1:** Separadores "Email | WhatsApp" na página de templates; lista + criar/editar/apagar templates WhatsApp (sem campo assunto). Mostrar chips das variáveis disponíveis (`{{nome}}`, `{{agente}}`, `{{agencia}}`).
- [ ] **Step 2: Commit**

---

### Task 7: WhatsApp resposta rápida na lead

**Files:**
- Create: `components/leads/WhatsAppModal.tsx`, `lib/whatsapp/utils.ts`
- Modify: `app/(app)/leads/[id]/page.tsx`

- [ ] **Step 1:** `lib/whatsapp/utils.ts` — `normalizePhone(phone)` (remove não-dígitos, prefixo 351 quando número PT de 9 dígitos), `buildWaLink(phone, text)`.
- [ ] **Step 2:** `WhatsAppModal` — escolher template → preview com variáveis preenchidas (editável) → "Abrir WhatsApp" (`window.open(waLink)`) + regista contacto tipo `whatsapp` via `/api/contacts`.
- [ ] **Step 3:** Botão WhatsApp na página da lead (visível quando tem telefone).
- [ ] **Step 4: Commit**

---

### Task 8: Webhook Business API + guia

**Files:**
- Create: `app/api/whatsapp/webhook/route.ts`, `docs/WHATSAPP_SETUP.md`

- [ ] **Step 1:** Webhook — GET: verificação Meta (`hub.mode/hub.verify_token/hub.challenge` vs `WHATSAPP_VERIFY_TOKEN`); POST: extrai mensagens de texto, encontra lead pelo telefone (service client), grava `whatsapp_messages` inbound, dispara `triggerAutomations({ type: 'whatsapp_message_received', ... }, serviceClient)`. Responde sempre 200.
- [ ] **Step 2:** `docs/WHATSAPP_SETUP.md` — passos Meta Business + env vars + custos + janela 24h.
- [ ] **Step 3: Commit**

---

### Task 9: Design system + animações em globals.css

**Files:**
- Modify: `app/globals.css`
- Create: `components/ui/Icon.tsx`

- [ ] **Step 1:** Expandir tokens (sombras, raios, escala de superfícies) e adicionar classes: `.card`, `.card-hover`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.input`, `.label`, `.badge`, `.skeleton`, `.modal-backdrop`, `.modal`, `.page-enter`, `.stagger > *`, `.table-row`. Keyframes: `fadeUp`, `scaleIn`, `shimmer`, `slideInRight`. `@media (prefers-reduced-motion: reduce)` desliga tudo.
- [ ] **Step 2:** `Icon.tsx` — componente com paths SVG (stroke 1.5) para: dashboard, leads, pipeline, pessoas, organizações, imóveis, atividades, relatórios, definições, automações, formulários, email, whatsapp, equipa, mais, lápis, lixo, fechar, enviar, sino.
- [ ] **Step 3: Commit**

---

### Task 10: Aplicar redesenho

**Files:**
- Modify: `components/layout/Sidebar.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/leads/page.tsx`, `app/(app)/leads/[id]/page.tsx`, `components/pipeline/KanbanBoard.tsx`, `components/leads/SendEmailModal.tsx`, `components/leads/NewLeadModal.tsx`, `components/dashboard/StatCard.tsx`, páginas de settings

- [ ] **Step 1:** Sidebar com ícones SVG + animações.
- [ ] **Step 2:** Dashboard/StatCard com classes novas, animação stagger, skeletons.
- [ ] **Step 3:** Modais com `.modal-backdrop`/`.modal` (scale-in + blur).
- [ ] **Step 4:** Listas (leads, pessoas, etc.) com hover/transições; kanban polido.
- [ ] **Step 5: Commit**

---

### Task 11: Verificação

- [ ] **Step 1:** `npm run build` limpo.
- [ ] **Step 2:** Correr a app, verificar visualmente: dashboard, leads, criar regra de automação send_email, resposta rápida WhatsApp, templates WhatsApp, definições agência.
- [ ] **Step 3:** Commit final.
