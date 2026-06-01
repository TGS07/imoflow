# Team Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir ao admin criar, listar, alterar o role e remover membros da equipa, e restringir agentes a ver apenas os seus próprios leads e a aceder às páginas de configuração.

**Architecture:** Sem nova tabela — `public.users` já tem `role text` (admin/agent). Cinco endpoints novos em `/api/team`. Settings protegidos por um layout server component que redireciona agentes. Agentes filtrados ao nível da API de leads e da página do pipeline. Sidebar filtra a secção Sistema para não-admins.

**Tech Stack:** Next.js 15 (app router), Supabase, TypeScript. Sem novas dependências.

---

## Estrutura de Ficheiros

| Ficheiro | Ação | Responsabilidade |
|---------|------|-----------------|
| `app/api/team/route.ts` | Criar | GET list + POST create membro |
| `app/api/team/[id]/route.ts` | Criar | PATCH role + DELETE membro |
| `app/(app)/settings/team/page.tsx` | Criar | Lista de membros com acções inline |
| `app/(app)/settings/team/new/page.tsx` | Criar | Formulário criar membro |
| `app/(app)/settings/layout.tsx` | Criar | Redirect agentes para /dashboard |
| `app/(app)/layout.tsx` | Modificar | Adicionar `role` ao select do perfil, passar a Sidebar |
| `components/layout/Sidebar.tsx` | Modificar | Prop `userRole`, filtrar Sistema para admins, adicionar link Equipa |
| `app/api/leads/route.ts` | Modificar | Filtrar leads por `assigned_to` quando agent |
| `app/(app)/pipeline/page.tsx` | Modificar | Filtrar leads por `assigned_to` quando agent |
| `app/api/forms/route.ts` | Modificar | Adicionar admin check ao POST |
| `app/api/forms/[id]/route.ts` | Modificar | Adicionar admin check ao PATCH e DELETE |
| `app/api/automations/[id]/route.ts` | Modificar | Adicionar admin check ao PATCH |

---

## Task 1: Team APIs

**Files:**
- Create: `app/api/team/route.ts`
- Create: `app/api/team/[id]/route.ts`

- [ ] **Step 1: Criar `app/api/team/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
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

  const { data: members, error } = await supabase
    .from('users')
    .select('id, name, email, role, avatar_initials, created_at')
    .eq('agency_id', profile.agency_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: leadRows } = await supabase
    .from('leads')
    .select('assigned_to')
    .eq('agency_id', profile.agency_id)
    .not('assigned_to', 'is', null)

  const countMap: Record<string, number> = {}
  for (const row of leadRows ?? []) {
    if (row.assigned_to) countMap[row.assigned_to] = (countMap[row.assigned_to] ?? 0) + 1
  }

  const result = (members ?? []).map(m => ({ ...m, lead_count: countMap[m.id] ?? 0 }))
  return NextResponse.json({ members: result, current_user_id: user.id })
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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let name: string, email: string, password: string, role: string
  try {
    const body = await request.json()
    name = body.name
    email = body.email
    password = body.password
    role = body.role ?? 'agent'
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'name, email e password são obrigatórios' }, { status: 400 })
  }
  if (password.trim().length < 8) {
    return NextResponse.json({ error: 'password deve ter pelo menos 8 caracteres' }, { status: 400 })
  }
  if (role !== 'admin' && role !== 'agent') {
    return NextResponse.json({ error: 'role deve ser admin ou agent' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email: email.trim(),
    password: password.trim(),
    email_confirm: true,
  })

  if (authError) {
    const status = authError.message.toLowerCase().includes('already') ? 409 : 500
    return NextResponse.json({ error: authError.message }, { status })
  }

  const initials = name.trim().split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const { data: newProfile, error: profileError } = await service
    .from('users')
    .insert({
      id: authUser.user.id,
      agency_id: profile.agency_id,
      name: name.trim(),
      email: email.trim(),
      role,
      avatar_initials: initials,
    })
    .select('id, name, email, role, avatar_initials, created_at')
    .single()

  if (profileError) {
    await service.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json(newProfile, { status: 201 })
}
```

- [ ] **Step 2: Criar `app/api/team/[id]/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
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

  if (id === user.id) {
    return NextResponse.json({ error: 'Não podes alterar o teu próprio role' }, { status: 400 })
  }

  let role: string
  try {
    const body = await request.json()
    role = body.role
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (role !== 'admin' && role !== 'agent') {
    return NextResponse.json({ error: 'role deve ser admin ou agent' }, { status: 400 })
  }

  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .single()

  if (!target) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', id)
    .select('id, name, email, role, avatar_initials, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
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

  if (id === user.id) {
    return NextResponse.json({ error: 'Não podes remover-te a ti próprio' }, { status: 400 })
  }

  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .single()

  if (!target) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const reassignTo: string | null = body.reassign_to ?? null

  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', id)

  if ((count ?? 0) > 0 && !reassignTo) {
    return NextResponse.json({ error: 'Este membro tem leads atribuídos. Indica um membro para reatribuir.' }, { status: 400 })
  }

  if (reassignTo && (count ?? 0) > 0) {
    const { error: reassignError } = await supabase
      .from('leads')
      .update({ assigned_to: reassignTo })
      .eq('assigned_to', id)
    if (reassignError) return NextResponse.json({ error: reassignError.message }, { status: 500 })
  }

  const service = createServiceClient()
  const { error: deleteError } = await service.auth.admin.deleteUser(id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: Verificar build**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript nos ficheiros novos.

- [ ] **Step 4: Commit**

```bash
git add app/api/team/route.ts app/api/team/[id]/route.ts
git commit -m "feat: add team management APIs (list, create, update role, delete)"
```

---

## Task 2: Team Backoffice Pages

**Files:**
- Create: `app/(app)/settings/team/page.tsx`
- Create: `app/(app)/settings/team/new/page.tsx`

- [ ] **Step 1: Criar `app/(app)/settings/team/page.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Member = {
  id: string
  name: string
  email: string
  role: 'admin' | 'agent'
  avatar_initials: string
  created_at: string
  lead_count: number
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [reassignTo, setReassignTo] = useState<string>('')
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    fetch('/api/team')
      .then(r => {
        if (!r.ok) throw new Error('Erro ao carregar equipa')
        return r.json()
      })
      .then(d => {
        setMembers(d.members)
        setCurrentUserId(d.current_user_id)
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar equipa.'); setLoading(false) })
  }, [])

  async function handleRoleChange(id: string, role: 'admin' | 'agent') {
    setUpdatingRole(id)
    const res = await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m))
    }
    setUpdatingRole(null)
  }

  function openRemove(member: Member) {
    setRemoveTarget(member)
    setReassignTo('')
    setRemoveError(null)
  }

  async function confirmRemove() {
    if (!removeTarget) return
    if (removeTarget.lead_count > 0 && !reassignTo) {
      setRemoveError('Selecciona um membro para reatribuir os leads.')
      return
    }
    setRemoving(true)
    setRemoveError(null)
    const res = await fetch(`/api/team/${removeTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassign_to: reassignTo || null }),
    })
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== removeTarget.id))
      setRemoveTarget(null)
    } else {
      const data = await res.json()
      setRemoveError(data.error ?? 'Erro ao remover membro.')
    }
    setRemoving(false)
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7,
    padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none',
    fontFamily: 'Jost, sans-serif',
  }

  const otherMembers = members.filter(m => m.id !== removeTarget?.id)

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Equipa</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Membros da tua agência e os seus acessos.</p>
        </div>
        <Link
          href="/settings/team/new"
          style={{ background: 'var(--gold)', color: '#0D0D0F', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          + Adicionar membro
        </Link>
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>A carregar...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {members.map(member => {
            const isSelf = member.id === currentUserId
            return (
              <div key={member.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
                  {member.avatar_initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{member.name}</span>
                    {isSelf && <span style={{ fontSize: 10, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>tu</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{member.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Desde {new Date(member.created_at).toLocaleDateString('pt-PT')}
                    {member.lead_count > 0 && ` · ${member.lead_count} lead${member.lead_count !== 1 ? 's' : ''}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <select
                    value={member.role}
                    disabled={isSelf || updatingRole === member.id}
                    onChange={e => handleRoleChange(member.id, e.target.value as 'admin' | 'agent')}
                    style={{ ...inputStyle, opacity: isSelf ? 0.4 : 1, cursor: isSelf ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="admin">Admin</option>
                    <option value="agent">Agente</option>
                  </select>
                  <button
                    disabled={isSelf}
                    onClick={() => openRemove(member)}
                    style={{ background: 'none', border: '1px solid #EF4444', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#EF4444', cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? 0.3 : 1 }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Remove modal */}
      {removeTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 32px', maxWidth: 420, width: '100%' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Remover membro</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Tens a certeza que queres remover <strong style={{ color: 'var(--text)' }}>{removeTarget.name}</strong>? Esta acção não pode ser desfeita.
            </p>

            {removeTarget.lead_count > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="reassign-select" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Reatribuir {removeTarget.lead_count} lead{removeTarget.lead_count !== 1 ? 's' : ''} para:
                </label>
                <select
                  id="reassign-select"
                  value={reassignTo}
                  onChange={e => setReassignTo(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  <option value="">— Selecciona um membro —</option>
                  {otherMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {removeError && <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>{removeError}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRemoveTarget(null)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmRemove}
                disabled={removing}
                style={{ background: '#EF4444', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: removing ? 'not-allowed' : 'pointer', opacity: removing ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}
              >
                {removing ? 'A remover...' : 'Confirmar remoção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar `app/(app)/settings/team/new/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewMemberPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'agent'>('agent')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
    fontFamily: 'Jost, sans-serif', width: '100%', boxSizing: 'border-box',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Todos os campos são obrigatórios.')
      return
    }
    if (password.length < 8) {
      setError('A password deve ter pelo menos 8 caracteres.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
    })
    if (res.ok) {
      router.push('/settings/team')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Erro ao criar membro.')
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 500 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 28 }}>Adicionar membro</h1>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="member-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome completo *</label>
          <input id="member-name" type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ana Silva" />
        </div>

        <div>
          <label htmlFor="member-email" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Email *</label>
          <input id="member-email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="ana@agencia.pt" />
        </div>

        <div>
          <label htmlFor="member-password" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Password *</label>
          <input id="member-password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="Mínimo 8 caracteres" />
        </div>

        <div>
          <label htmlFor="member-role" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Role *</label>
          <select id="member-role" value={role} onChange={e => setRole(e.target.value as 'admin' | 'agent')} style={inputStyle}>
            <option value="agent">Agente</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}
          >
            {saving ? 'A criar...' : 'Criar membro'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/team')}
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

- [ ] **Step 3: Verificar build**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/settings/team/page.tsx app/(app)/settings/team/new/page.tsx
git commit -m "feat: add team management backoffice pages"
```

---

## Task 3: Role-Aware Sidebar + Layout + Settings Protection

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Create: `app/(app)/settings/layout.tsx`

- [ ] **Step 1: Actualizar `app/(app)/layout.tsx`**

Adicionar `role` ao select do perfil e passá-lo à Sidebar. Ficheiro actual em `app/(app)/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { NotificationBell } from '@/components/layout/NotificationBell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, avatar_initials, role')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      <Sidebar
        userName={profile?.name ?? user.email ?? ''}
        userInitials={profile?.avatar_initials ?? 'XX'}
        userRole={(profile?.role as 'admin' | 'agent') ?? 'agent'}
      />
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          <NotificationBell />
        </header>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Actualizar `components/layout/Sidebar.tsx`**

Adicionar `userRole` às props, adicionar link Equipa, filtrar secção Sistema para não-admins:

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard', section: 'Principal' },
  { href: '/leads', icon: '◎', label: 'Leads', section: 'Principal' },
  { href: '/pipeline', icon: '◈', label: 'Pipeline', section: 'Principal' },
  { href: '/people', icon: '👤', label: 'Pessoas', section: 'Principal' },
  { href: '/organizations', icon: '🏢', label: 'Organizações', section: 'Principal' },
  { href: '/properties', icon: '🏠', label: 'Imóveis', section: 'Principal' },
  { href: '/activities', icon: '📅', label: 'Atividades', section: 'Principal' },
  { href: '/reports', icon: '📊', label: 'Relatórios', section: 'Principal' },
  { href: '/settings/pipeline', icon: '⚙', label: 'Configurações', section: 'Sistema' },
  { href: '/settings/automations', icon: '⚡', label: 'Automações', section: 'Sistema' },
  { href: '/settings/forms', icon: '📋', label: 'Formulários', section: 'Sistema' },
  { href: '/settings/team', icon: '👥', label: 'Equipa', section: 'Sistema' },
]

type Props = {
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
}

export function Sidebar({ userName, userInitials, userRole }: Props) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(item => item.section !== 'Sistema' || userRole === 'admin')

  return (
    <aside style={{ width: 240, minHeight: '100vh', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0 }}>
      <div style={{ padding: '0 24px 32px', borderBottom: '1px solid var(--border)' }}>
        <div className="font-display" style={{ fontSize: 22, color: 'var(--gold)' }}>ImoFlow</div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 2 }}>CRM Imobiliário</div>
      </div>

      <nav style={{ padding: '24px 0', flex: 1 }}>
        {['Principal', 'Sistema'].map(section => {
          const sectionItems = visibleItems.filter(item => item.section === section)
          if (sectionItems.length === 0) return null
          return (
            <div key={section}>
              <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 24px', marginBottom: 6, marginTop: 16 }}>{section}</div>
              {sectionItems.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', fontSize: 13, color: active ? 'var(--gold)' : 'var(--muted)', background: active ? 'var(--gold-glow)' : 'transparent', borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent', textDecoration: 'none', transition: 'all 0.2s' }}>
                    <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
          {userInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Criar `app/(app)/settings/layout.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ReactNode } from 'react'

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return <>{children}</>
}
```

- [ ] **Step 4: Verificar build**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/layout.tsx components/layout/Sidebar.tsx app/(app)/settings/layout.tsx
git commit -m "feat: role-aware sidebar and settings protection for agents"
```

---

## Task 4: Agent Lead Visibility

**Files:**
- Modify: `app/api/leads/route.ts`
- Modify: `app/(app)/pipeline/page.tsx`

- [ ] **Step 1: Actualizar `app/api/leads/route.ts` GET**

Localizar o bloco GET (linhas 6-29). Substituir com a versão que inclui role check:

```typescript
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const { searchParams } = new URL(request.url)
  const stageId = searchParams.get('stage_id')
  const search = searchParams.get('search')

  let query = supabase
    .from('leads')
    .select('*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), people(id, name, email, phone), organizations(id, name), properties(id, reference, title, price, type)')
    .order('created_at', { ascending: false })

  if (profile?.role === 'agent') query = query.eq('assigned_to', user.id)
  if (stageId) query = query.eq('stage_id', stageId)
  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

O bloco POST não é alterado.

- [ ] **Step 2: Actualizar `app/(app)/pipeline/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { Lead, PipelineStage } from '@/types'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  let leadsQuery = supabase
    .from('leads')
    .select('*, pipeline_stages(id, name, color, position, probability, is_won, is_lost)')
    .order('created_at', { ascending: false })

  if (profile?.role === 'agent') leadsQuery = leadsQuery.eq('assigned_to', user.id)

  const [{ data: leads }, { data: stages }] = await Promise.all([
    leadsQuery,
    supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
  ])

  return (
    <>
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 className="font-display" style={{ fontSize: 20 }}>Pipeline</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{leads?.length ?? 0} leads no pipeline</p>
      </div>
      <div style={{ padding: '24px 32px', flex: 1, overflow: 'hidden' }}>
        <KanbanBoard initialLeads={(leads ?? []) as Lead[]} stages={(stages ?? []) as PipelineStage[]} />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verificar build**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add app/api/leads/route.ts app/(app)/pipeline/page.tsx
git commit -m "feat: filter leads by assigned_to for agent role"
```

---

## Task 5: Protect Forms & Automations API Mutations

**Files:**
- Modify: `app/api/forms/route.ts`
- Modify: `app/api/forms/[id]/route.ts`
- Modify: `app/api/automations/[id]/route.ts`

- [ ] **Step 1: Actualizar `app/api/forms/route.ts` POST**

O POST já faz fetch do profile com `agency_id`. Apenas adicionar `role` ao select e verificar antes de continuar. Substituir as linhas 23-28 (fetch do profile) por:

```typescript
  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

- [ ] **Step 2: Actualizar `app/api/forms/[id]/route.ts` PATCH e DELETE**

Tanto PATCH como DELETE precisam de verificar o role. Adicionar após a verificação `if (!user)` em cada handler:

Para PATCH (após linha `if (!user) return NextResponse.json...`):
```typescript
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

Para DELETE (após linha `if (!user) return NextResponse.json...`):
```typescript
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

- [ ] **Step 3: Actualizar `app/api/automations/[id]/route.ts` PATCH**

Adicionar verificação de role após `if (!user)`:

```typescript
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

- [ ] **Step 4: Verificar build**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add app/api/forms/route.ts app/api/forms/[id]/route.ts app/api/automations/[id]/route.ts
git commit -m "feat: restrict forms and automations mutations to admin role"
```

---

## Deploy Manual

Não é necessária migration SQL para este módulo — a tabela `public.users` já tem a coluna `role`.

Após push para `main` e deploy do Vercel, o módulo está activo.
