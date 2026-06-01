# Email Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar templates de email reutilizáveis, com backoffice admin para gerir e picker no modal de envio para agentes.

**Architecture:** Nova tabela `email_templates` com RLS por agência. 4 endpoints REST (admin-only para escrita, leitura aberta). Backoffice com lista/criar/editar. O `SendEmailModal` existente ganha um select de templates que preenche automaticamente subject+body.

**Tech Stack:** Next.js 15 App Router, Supabase (RLS), TypeScript, React inline styles (padrão do projecto)

---

## File Structure

**Novos ficheiros:**
- `supabase/migrations/20260601_email_templates.sql` — migration da tabela
- `app/api/email-templates/route.ts` — GET list + POST create
- `app/api/email-templates/[id]/route.ts` — PATCH update + DELETE
- `app/(app)/settings/templates/page.tsx` — lista de templates
- `app/(app)/settings/templates/new/page.tsx` — formulário criar
- `app/(app)/settings/templates/[id]/page.tsx` — formulário editar

**Ficheiros modificados:**
- `components/layout/Sidebar.tsx` — adicionar link "Templates Email"
- `components/leads/SendEmailModal.tsx` — adicionar template picker

---

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20260601_email_templates.sql`

- [ ] **Step 1: Criar ficheiro de migration**

```sql
CREATE TABLE public.email_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  subject    TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_templates_agency_idx ON public.email_templates(agency_id);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates: own agency" ON public.email_templates
  FOR ALL TO authenticated
  USING (agency_id = public.get_my_agency_id())
  WITH CHECK (agency_id = public.get_my_agency_id());
```

- [ ] **Step 2: Aplicar migration no Supabase**

No dashboard do Supabase → SQL Editor, colar e executar o SQL acima.

Verificar que a tabela `email_templates` aparece em Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260601_email_templates.sql
git commit -m "feat: add email_templates table migration"
```

---

### Task 2: API Endpoints

**Files:**
- Create: `app/api/email-templates/route.ts`
- Create: `app/api/email-templates/[id]/route.ts`

- [ ] **Step 1: Criar `app/api/email-templates/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('email_templates')
    .select('id, name, subject, body, created_at')
    .eq('agency_id', profile.agency_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { name?: string; subject?: string; body?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name?.trim() || !body.subject?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: 'name, subject e body são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      agency_id: profile.agency_id,
      name: body.name.trim(),
      subject: body.subject.trim(),
      body: body.body.trim(),
    })
    .select('id, name, subject, body, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Criar `app/api/email-templates/[id]/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { name?: string; subject?: string; body?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, string> = {}
  if (typeof body.name === 'string') updates.name = body.name.trim()
  if (typeof body.subject === 'string') updates.subject = body.subject.trim()
  if (typeof body.body === 'string') updates.body = body.body.trim()

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .select('id, name, subject, body, created_at')
    .single()

  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('agency_id', profile.agency_id)

  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: Verificar types**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/api/email-templates/route.ts app/api/email-templates/[id]/route.ts
git commit -m "feat: add email-templates API endpoints"
```

---

### Task 3: Backoffice — Lista de Templates

**Files:**
- Create: `app/(app)/settings/templates/page.tsx`

- [ ] **Step 1: Criar `app/(app)/settings/templates/page.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  created_at: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => {
        if (!r.ok) throw new Error('Erro ao carregar templates')
        return r.json()
      })
      .then(d => { setTemplates(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar templates.'); setLoading(false) })
  }, [])

  async function deleteTemplate(id: string) {
    if (!confirm('Eliminar este template? Esta acção não pode ser desfeita.')) return
    setDeleting(id)
    const res = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 404) {
      setTemplates(prev => prev.filter(t => t.id !== id))
    }
    setDeleting(null)
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Templates de Email</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Templates reutilizáveis para envio de emails a leads.</p>
        </div>
        <Link
          href="/settings/templates/new"
          style={{ background: 'var(--gold)', color: '#0D0D0F', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          + Novo template
        </Link>
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>A carregar...</p>
      ) : templates.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum template criado ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {templates.map(template => (
            <div key={template.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>{template.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {template.subject}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link
                  href={`/settings/templates/${template.id}`}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}
                >
                  Editar
                </Link>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  disabled={deleting === template.id}
                  style={{ background: 'none', border: '1px solid #EF4444', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#EF4444', cursor: 'pointer', opacity: deleting === template.id ? 0.5 : 1 }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar types**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/settings/templates/page.tsx
git commit -m "feat: add email templates list page"
```

---

### Task 4: Backoffice — Criar e Editar Template

**Files:**
- Create: `app/(app)/settings/templates/new/page.tsx`
- Create: `app/(app)/settings/templates/[id]/page.tsx`

- [ ] **Step 1: Criar `app/(app)/settings/templates/new/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewTemplatePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
    fontFamily: 'Jost, sans-serif', width: '100%', boxSizing: 'border-box',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError('Todos os campos são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), subject: subject.trim(), body: body.trim() }),
      })
      if (res.ok) {
        router.push('/settings/templates')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Erro ao criar template.')
      }
    } catch {
      setError('Erro de rede. Verifica a tua ligação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 28 }}>Novo template</h1>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="tpl-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome *</label>
          <input id="tpl-name" type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ex: Apresentação inicial" />
        </div>
        <div>
          <label htmlFor="tpl-subject" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Assunto *</label>
          <input id="tpl-subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} placeholder="Ex: A sua pesquisa de imóvel" />
        </div>
        <div>
          <label htmlFor="tpl-body" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Corpo *</label>
          <textarea
            id="tpl-body"
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 160, lineHeight: 1.6 }}
            placeholder="Escreve o corpo do email aqui..."
          />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}
          >
            {saving ? 'A criar...' : 'Criar template'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/templates')}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Criar `app/(app)/settings/templates/[id]/page.tsx`**

```typescript
'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => r.json())
      .then((templates: Array<{ id: string; name: string; subject: string; body: string }>) => {
        const tpl = templates.find(t => t.id === id)
        if (tpl) {
          setName(tpl.name)
          setSubject(tpl.subject)
          setBody(tpl.body)
        }
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar template.'); setLoading(false) })
  }, [id])

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
    fontFamily: 'Jost, sans-serif', width: '100%', boxSizing: 'border-box',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError('Todos os campos são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), subject: subject.trim(), body: body.trim() }),
      })
      if (res.ok) {
        router.push('/settings/templates')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Erro ao actualizar template.')
      }
    } catch {
      setError('Erro de rede. Verifica a tua ligação.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '32px 40px', fontSize: 13, color: 'var(--muted)' }}>A carregar...</div>

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 28 }}>Editar template</h1>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="tpl-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome *</label>
          <input id="tpl-name" type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="tpl-subject" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Assunto *</label>
          <input id="tpl-subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="tpl-body" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Corpo *</label>
          <textarea
            id="tpl-body"
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 160, lineHeight: 1.6 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}
          >
            {saving ? 'A guardar...' : 'Guardar alterações'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/templates')}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Verificar types**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/settings/templates/new/page.tsx" "app/(app)/settings/templates/[id]/page.tsx"
git commit -m "feat: add email template create and edit pages"
```

---

### Task 5: Sidebar — Adicionar Link Templates

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Adicionar o item ao array `navItems`**

No ficheiro `components/layout/Sidebar.tsx`, localizar o array `navItems` (linha 5). O array tem actualmente estes itens de Sistema:

```typescript
{ href: '/settings/pipeline', icon: '⚙', label: 'Configurações', section: 'Sistema' },
{ href: '/settings/automations', icon: '⚡', label: 'Automações', section: 'Sistema' },
{ href: '/settings/forms', icon: '📋', label: 'Formulários', section: 'Sistema' },
{ href: '/settings/team', icon: '👥', label: 'Equipa', section: 'Sistema' },
```

Substituir por (adicionar linha de Templates antes de Equipa):

```typescript
{ href: '/settings/pipeline', icon: '⚙', label: 'Configurações', section: 'Sistema' },
{ href: '/settings/automations', icon: '⚡', label: 'Automações', section: 'Sistema' },
{ href: '/settings/forms', icon: '📋', label: 'Formulários', section: 'Sistema' },
{ href: '/settings/templates', icon: '✉', label: 'Templates Email', section: 'Sistema' },
{ href: '/settings/team', icon: '👥', label: 'Equipa', section: 'Sistema' },
```

O filtro `visibleItems` existente já trata de ocultar itens de Sistema a agentes — nenhuma outra alteração necessária.

- [ ] **Step 2: Verificar types**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: add Templates Email link to sidebar"
```

---

### Task 6: SendEmailModal — Template Picker

**Files:**
- Modify: `components/leads/SendEmailModal.tsx`

O componente actual (`components/leads/SendEmailModal.tsx`) tem estado `to`, `subject`, `body`, `loading`, `error`. É necessário adicionar:
1. Estado `templates` (lista carregada no mount) e `selectedTemplate` (id seleccionado)
2. Select no topo do formulário
3. `useEffect` para carregar templates

- [ ] **Step 1: Reescrever `components/leads/SendEmailModal.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
}

type Props = {
  leadId: string
  leadEmail: string | null
  onClose: () => void
  onSent: () => void
}

export function SendEmailModal({ leadId, leadEmail, onClose, onSent }: Props) {
  const [to, setTo] = useState(leadEmail ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')

  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => r.ok ? r.json() : [])
      .then((data: EmailTemplate[]) => setTemplates(data))
      .catch(() => {})
  }, [])

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplate(templateId)
    if (!templateId) return
    const tpl = templates.find(t => t.id === templateId)
    if (tpl) {
      setSubject(tpl.subject)
      setBody(tpl.body)
    }
  }

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }
  const labelStyle = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, to_email: to, subject, body }),
      })
      if (res.ok) { onSent(); onClose() }
      else { const d = await res.json(); setError(d.error ?? 'Erro ao enviar.') }
    } catch {
      setError('Erro de rede ao enviar email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Enviar Email</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {templates.length > 0 && (
            <div>
              <label style={labelStyle}>Usar template</label>
              <select
                value={selectedTemplate}
                onChange={e => handleTemplateSelect(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">— Nenhum —</option>
                {templates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
            </div>
          )}
          <div><label style={labelStyle}>Para</label><input type="email" style={inputStyle} value={to} onChange={e => setTo(e.target.value)} required /></div>
          <div><label style={labelStyle}>Assunto</label><input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} required /></div>
          <div>
            <label style={labelStyle}>Mensagem</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.6 }} value={body} onChange={e => setBody(e.target.value)} required />
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 11, fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, color: '#0D0D0F', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Jost, sans-serif' }}>
              {loading ? 'A enviar...' : '✉ Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar types**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/leads/SendEmailModal.tsx
git commit -m "feat: add template picker to SendEmailModal"
```

---

### Task 7: Build Final + Push

- [ ] **Step 1: Build completo**

```bash
npm run build
```

Esperado: `✓ Compiled successfully` sem erros de tipo ou compilação.

- [ ] **Step 2: Push para main**

```bash
git push origin main
```

- [ ] **Step 3: Aplicar migration no Supabase (se não feito na Task 1)**

Se a migration ainda não foi aplicada, ir ao Supabase Dashboard → SQL Editor e executar o SQL da Task 1.
