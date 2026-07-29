# Siglas de contacto + preço na secção "Procura" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma página de definições com a lista oficial de "siglas" de contacto (CC, CV, SCC, SR — criáveis pela UI), e adicionar um campo de preço máximo em falta na secção "Procura" do formulário/painel de contacto.

**Architecture:** Nova tabela `contact_siglas` (padrão idêntico a `custom_fields`: scoping por `agency_id`, RLS "own agency") + rota API `GET`/`POST` + página de definições cliente que segue o padrão de `app/(app)/settings/pipeline/page.tsx`. O campo de preço é um novo atributo opcional dentro do `jsonb` `ContactDetails` já existente — sem migração, sem alteração de API — replicando exatamente o padrão do campo `selling_price` já existente na secção "Venda".

**Tech Stack:** Next.js (App Router), Supabase (Postgres + RLS), TypeScript. Sem framework de testes automatizados neste repositório — verificação é manual (build + fluxo na UI/API), seguindo o padrão dos specs anteriores.

---

### Task 1: Migração — tabela `contact_siglas`

**Files:**
- Create: `supabase/migrations/20260729_contact_siglas.sql`

- [ ] **Step 1: Escrever a migração**

```sql
-- CONTACT SIGLAS
create table public.contact_siglas (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  code text not null,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(agency_id, code)
);

create index contact_siglas_agency_idx on contact_siglas(agency_id);

alter table public.contact_siglas enable row level security;
create policy "contact_siglas: own agency" on public.contact_siglas
  for all using (agency_id = public.get_my_agency_id());

-- SEED: siglas já usadas manualmente pelo utilizador na configuração de contactos do iPhone/iCloud
do $$
declare
  agency record;
begin
  for agency in select id from public.agencies loop
    insert into public.contact_siglas (agency_id, code, label) values
      (agency.id, 'CC', 'Cliente Comprador'),
      (agency.id, 'CV', 'Cliente Vendedor'),
      (agency.id, 'SCC', 'Contabilista'),
      (agency.id, 'SR', 'Remodelações')
    on conflict (agency_id, code) do nothing;
  end loop;
end $$;
```

- [ ] **Step 2: Aplicar a migração**

Usar a tool MCP do Supabase (`apply_migration`, nome `contact_siglas`, com o SQL acima) — é o mecanismo já usado nas migrações recentes deste projeto (ver `supabase/migrations/20260728_calendar_sync.sql` como referência de padrão recente).

Expected: migração aplicada sem erro; `list_tables` mostra `contact_siglas` com RLS ativo.

- [ ] **Step 3: Confirmar o seed**

Executar via `execute_sql`:
```sql
select agency_id, code, label from public.contact_siglas order by agency_id, code;
```

Expected: 4 linhas por cada agência existente (`CC`, `CV`, `SCC`, `SR` com os rótulos corretos).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260729_contact_siglas.sql
git commit -m "feat: tabela contact_siglas com seed CC/CV/SCC/SR"
```

---

### Task 2: Tipo TypeScript `ContactSigla`

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Adicionar o tipo**

Junto ao tipo `CustomField` (por volta da linha 46 de `types/index.ts`), adicionar:

```ts
export type ContactSigla = {
  id: string
  agency_id: string
  code: string
  label: string
  is_active: boolean
  created_at: string
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros de tipo (o tipo novo ainda não é usado em lado nenhum, não pode quebrar nada).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: tipo ContactSigla"
```

---

### Task 3: Rota API `contact-siglas`

**Files:**
- Create: `app/api/contact-siglas/route.ts`

- [ ] **Step 1: Escrever a rota**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('contact_siglas')
    .select('*')
    .eq('is_active', true)
    .order('code', { ascending: true })

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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const code = String(body.code ?? '').trim().toUpperCase().replace(/\s+/g, '')
  const label = String(body.label ?? '').trim()

  if (!code || !label) {
    return NextResponse.json({ error: 'Código e rótulo são obrigatórios.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('contact_siglas')
    .insert({ agency_id: profile.agency_id, code, label })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma sigla com este código.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 3: Testar manualmente a rota**

Com o servidor de dev a correr e sessão autenticada (usar o browser preview, não `curl` sem cookies de sessão):
- `GET /api/contact-siglas` → devolve as 4 siglas seed.
- `POST /api/contact-siglas` com `{"code":"AV","label":"Avaliador"}` (utilizador admin) → 201, sigla nova aparece num `GET` seguinte.
- Repetir o mesmo `POST` → 409 com `"Já existe uma sigla com este código."`.

- [ ] **Step 4: Commit**

```bash
git add app/api/contact-siglas/route.ts
git commit -m "feat: API contact-siglas (GET, POST)"
```

---

### Task 4: Página de definições `/settings/siglas`

**Files:**
- Create: `app/(app)/settings/siglas/page.tsx`

- [ ] **Step 1: Escrever a página**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { ContactSigla } from '@/types'

export default function SiglasSettingsPage() {
  const [siglas, setSiglas] = useState<ContactSigla[]>([])
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)' }

  useEffect(() => {
    fetch('/api/contact-siglas').then(r => r.json()).then((data: ContactSigla[]) => setSiglas(data))
  }, [])

  async function addSigla(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!code.trim() || !label.trim()) return
    setSaving(true)
    const res = await fetch('/api/contact-siglas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, label }),
    })
    setSaving(false)
    if (res.ok) {
      const sigla = await res.json()
      setSiglas(prev => [...prev, sigla].sort((a, b) => a.code.localeCompare(b.code)))
      setCode('')
      setLabel('')
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Não foi possível criar a sigla.')
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Siglas de contacto</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Lista de referência das siglas usadas para classificar contactos (ex.: na configuração de contactos do iPhone/iCloud). Esta lista não sincroniza automaticamente com o iPhone.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {siglas.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 48 }}>{s.code}</span>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{s.label}</span>
          </div>
        ))}
        {siglas.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sem siglas ainda.</div>
        )}
      </div>

      <form onSubmit={addSigla} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Criar nova sigla</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input style={{ ...inputStyle, width: 100 }} placeholder="Código" value={code} onChange={e => setCode(e.target.value)} />
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Rótulo" value={label} onChange={e => setLabel(e.target.value)} />
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--danger, #EF4444)' }}>{error}</div>}
        <button type="submit" className="btn" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'A criar…' : 'Criar sigla'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verificar o padrão de classe `btn` e variável `--danger`**

Antes de dar por concluído este passo, confirmar em `app/globals.css` (ou equivalente) se existe a classe `.btn` e a variável `--danger`. Se `--danger` não existir, substituir por uma cor inline segura (ex. `#EF4444`) mantendo `var(--danger, #EF4444)` como fallback já cobre este caso — não é necessário alterar CSS.

```bash
grep -n "\-\-danger\|\.btn " app/globals.css
```

Expected: confirma se a classe/variável existe; ajustar o JSX acima apenas se o grep não encontrar `.btn` (nesse caso, usar o mesmo padrão de botão usado em `app/(app)/settings/pipeline/page.tsx`).

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/settings/siglas/page.tsx"
git commit -m "feat: página de definições /settings/siglas"
```

---

### Task 5: Entrada na navegação lateral

**Files:**
- Modify: `components/layout/Sidebar.tsx:15-20`

- [ ] **Step 1: Adicionar a entrada**

Depois da linha `{ href: '/settings/team', icon: 'team', label: 'Equipa', section: 'Sistema' },` (linha 20), adicionar:

```ts
  { href: '/settings/siglas', icon: 'form', label: 'Siglas', section: 'Sistema' },
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros (o ícone `'form'` já existe em `IconName`, sem necessidade de tocar em `components/ui/Icon.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: entrada Siglas na navegação de definições"
```

---

### Task 6: Verificação manual — Task 1 a 5 (siglas, fim a fim)

**Files:** nenhum (só verificação, browser preview)

- [ ] **Step 1: Arrancar o dev server e abrir `/settings/siglas`**

Usar `preview_start` (nome do servidor de dev do `.claude/launch.json`, ou criar a entrada se não existir) e navegar para `/settings/siglas` autenticado como admin.

Expected: página mostra as 4 siglas seed (`CC`, `CV`, `SCC`, `SR`) com os rótulos corretos.

- [ ] **Step 2: Criar uma sigla nova pela UI**

Preencher "Código" com `AV` e "Rótulo" com `Avaliador`, submeter.

Expected: sigla aparece na lista, sem recarregar a página.

- [ ] **Step 3: Repetir a criação com o mesmo código**

Submeter `AV` / `Avaliador` outra vez.

Expected: mensagem de erro "Já existe uma sigla com este código." visível no formulário; lista não duplica a sigla.

- [ ] **Step 4: Confirmar bloqueio para não-admin**

Se possível testar com um utilizador não-admin (ou inspecionar `app/(app)/settings/layout.tsx` — já cobre todas as rotas `/settings/*`, sem alteração necessária): aceder a `/settings/siglas` redireciona para `/dashboard`.

---

### Task 7: Campo `looking_price` no tipo `ContactDetails`

**Files:**
- Modify: `types/contact.ts:9-11`

- [ ] **Step 1: Adicionar o campo**

```ts
  // comprador / investidor
  looking_for?: string
  search_zone?: string
  looking_price?: number
```

(inserir `looking_price?: number` logo depois de `search_zone?: string`, linha 11 de `types/contact.ts`)

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 3: Commit**

```bash
git add types/contact.ts
git commit -m "feat: campo looking_price em ContactDetails"
```

---

### Task 8: Campo de preço no formulário de criação/edição

**Files:**
- Modify: `components/contacts/ContactFormFields.tsx:99-109`

- [ ] **Step 1: Adicionar o input**

Substituir o bloco atual (linhas 99-109):

```tsx
      {(has('comprador') || has('investidor')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Procura</div>
          <input className="input" placeholder="O que procura" value={details.looking_for ?? ''} onChange={e => onDetailChange('looking_for', e.target.value)} />
          <input className="input" placeholder="Zona" value={details.search_zone ?? ''} onChange={e => onDetailChange('search_zone', e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" style={cb} checked={!!details.already_bought} onChange={e => onDetailChange('already_bought', e.target.checked)} />
            Já comprou connosco
          </label>
        </div>
      )}
```

por:

```tsx
      {(has('comprador') || has('investidor')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Procura</div>
          <input className="input" placeholder="O que procura" value={details.looking_for ?? ''} onChange={e => onDetailChange('looking_for', e.target.value)} />
          <input className="input" placeholder="Zona" value={details.search_zone ?? ''} onChange={e => onDetailChange('search_zone', e.target.value)} />
          <input className="input" type="number" placeholder="Preço máximo (€)" value={details.looking_price ?? ''} onChange={e => onDetailChange('looking_price', Number(e.target.value) || undefined)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" style={cb} checked={!!details.already_bought} onChange={e => onDetailChange('already_bought', e.target.checked)} />
            Já comprou connosco
          </label>
        </div>
      )}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/contacts/ContactFormFields.tsx
git commit -m "feat: campo Preço máximo na secção Procura do formulário"
```

---

### Task 9: Campo de preço no painel de detalhe do contacto

**Files:**
- Modify: `components/contacts/ContactDetailPanel.tsx:655-659`

- [ ] **Step 1: Adicionar o campo**

Substituir o bloco atual (linhas 655-659):

```tsx
                  {showBuyer && (
                    <>
                      {field('O que procura', fieldValue(d.looking_for), <input className="input" value={d.looking_for ?? ''} onChange={e => setDetail('looking_for', e.target.value)} />)}
                      {field('Zona', fieldValue(d.search_zone), <input className="input" value={d.search_zone ?? ''} onChange={e => setDetail('search_zone', e.target.value)} />)}
                      {boolField('Já comprou', 'already_bought')}
                    </>
                  )}
```

por:

```tsx
                  {showBuyer && (
                    <>
                      {field('O que procura', fieldValue(d.looking_for), <input className="input" value={d.looking_for ?? ''} onChange={e => setDetail('looking_for', e.target.value)} />)}
                      {field('Zona', fieldValue(d.search_zone), <input className="input" value={d.search_zone ?? ''} onChange={e => setDetail('search_zone', e.target.value)} />)}
                      {field('Preço máximo €', fieldValue(d.looking_price != null ? `€${d.looking_price.toLocaleString('pt-PT')}` : null), <input className="input" type="number" value={d.looking_price ?? ''} onChange={e => setDetail('looking_price', Number(e.target.value) || undefined)} />)}
                      {boolField('Já comprou', 'already_bought')}
                    </>
                  )}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/contacts/ContactDetailPanel.tsx
git commit -m "feat: campo Preço máximo na vista de detalhe (secção Procura)"
```

---

### Task 10: Verificação manual — Task 7 a 9 (preço em "Procura", fim a fim)

**Files:** nenhum (só verificação, browser preview)

- [ ] **Step 1: Criar um contacto novo do tipo Comprador**

No browser preview, abrir o modal de novo contacto, marcar tipo "Comprador", preencher "O que procura", "Zona" e "Preço máximo (€)" (ex. `250000`), guardar.

Expected: contacto criado sem erro.

- [ ] **Step 2: Confirmar persistência**

Abrir o painel de detalhe do contacto criado.

Expected: campo "Preço máximo €" mostra `€250.000` (formato `pt-PT`).

- [ ] **Step 3: Editar o valor no painel de detalhe**

Entrar em modo de edição, alterar o preço para `300000`, guardar.

Expected: valor atualizado persiste após reload da página; restantes campos (`looking_for`, `search_zone`, `already_bought`) inalterados.

- [ ] **Step 4: Confirmar contacto sem preço não quebra**

Abrir (ou criar) um contacto Comprador sem preencher "Preço máximo (€)".

Expected: campo aparece vazio no formulário e como "—" na vista de leitura, sem erro.

---

## Self-Review

**Cobertura da spec:**
- Parte A (siglas): Task 1 (tabela + seed), Task 2 (tipo), Task 3 (API GET/POST + 409), Task 4 (página listar+criar), Task 5 (nav), Task 6 (verificação) — cobre a spec integralmente, incluindo o limite explícito "sem ligação ao iPhone/iCloud" (mencionado no texto da página, Task 4) e "só listar + criar" (sem PATCH/DELETE em nenhuma task).
- Parte B (preço): Task 7 (tipo), Task 8 (formulário), Task 9 (painel de detalhe), Task 10 (verificação) — cobre o campo único (preço máximo), replicando o padrão `selling_price` em ambos os locais (formulário e painel), sem migração nem alteração de API, como definido na spec.
- Fora de âmbito da spec (editar/desativar siglas, intervalo de preço, ligação ao iPhone) — nenhuma task o implementa, consistente.

**Placeholders:** nenhum "TBD"/"similar a"/"adicionar validação apropriada" — todos os passos têm código completo ou comando+resultado esperado explícitos.

**Consistência de tipos:** `ContactSigla` (Task 2) usado tal e qual em `app/api/contact-siglas/route.ts` (implícito via `.select('*')`) e em `app/(app)/settings/siglas/page.tsx` (Task 4, `useState<ContactSigla[]>`). `looking_price?: number` (Task 7) usado com o mesmo nome em `ContactFormFields.tsx` (Task 8) e `ContactDetailPanel.tsx` (Task 9) — sem divergência de nomes entre tasks.
