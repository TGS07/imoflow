# Alternador de tema claro/escuro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um alternador manual de tema claro/escuro, com botão no cabeçalho junto ao sino de notificações, tema escuro suave (sem preto puro) e preferência persistida por utilizador em qualquer dispositivo.

**Architecture:** Segundo bloco de variáveis CSS (`[data-theme="dark"]`) em `app/globals.css`, ativado por um atributo `data-theme` no `<html>`. O valor inicial é lido de um cookie no layout raiz (server component, evita flash), reconciliado no cliente com o valor guardado em `users.theme` (fonte de verdade entre dispositivos) assim que a página monta. Um botão cliente (`ThemeToggle`) alterna o atributo, o cookie, e grava a mudança via `PATCH /api/users/me/theme`.

**Tech Stack:** Next.js 16 (App Router, `cookies()` assíncrono de `next/headers`), Supabase (Postgres), TypeScript. Sem framework de testes automatizados neste repositório — verificação é manual (build + fluxo na UI), seguindo o padrão dos planos anteriores.

---

### Task 1: Migração — coluna `theme` em `users`

**Files:**
- Create: `supabase/migrations/20260731_user_theme.sql`

- [ ] **Step 1: Escrever a migração**

```sql
alter table public.users
  add column if not exists theme text not null default 'light' check (theme in ('light', 'dark'));
```

- [ ] **Step 2: Aplicar a migração**

Usar a tool MCP do Supabase (`mcp__815f2f4b-6ae5-4702-9098-ffa5c7ad7442__apply_migration`, nome `user_theme`, com o SQL acima). Confirmar o `project_id` via `list_projects` se necessário (deve haver só um projeto ligado).

Expected: migração aplicada sem erro.

- [ ] **Step 3: Confirmar via SQL**

```sql
select id, theme from public.users limit 5;
```

Expected: todas as linhas devolvem `theme = 'light'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260731_user_theme.sql
git commit -m "feat: coluna theme em users"
```

---

### Task 2: Tipo `User` — campo `theme`

**Files:**
- Modify: `types/index.ts:12-19`

- [ ] **Step 1: Adicionar o campo**

O tipo atual:

```ts
export type User = {
  id: string
  agency_id: string
  name: string
  email: string
  role: 'admin' | 'agent'
  avatar_initials: string
}
```

Passa a:

```ts
export type User = {
  id: string
  agency_id: string
  name: string
  email: string
  role: 'admin' | 'agent'
  avatar_initials: string
  theme: 'light' | 'dark'
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros (o campo novo ainda não é lido em lado nenhum, não pode quebrar nada).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: campo theme no tipo User"
```

---

### Task 3: Ícones `sun` e `moon`

**Files:**
- Modify: `components/ui/Icon.tsx`

- [ ] **Step 1: Adicionar ao tipo `IconName`**

Linha 1-6 atual:

```ts
type IconName =
  | 'dashboard' | 'leads' | 'pipeline' | 'people' | 'building' | 'home'
  | 'calendar' | 'chart' | 'settings' | 'zap' | 'form' | 'mail'
  | 'whatsapp' | 'team' | 'plus' | 'pencil' | 'trash' | 'close'
  | 'send' | 'bell' | 'check' | 'x' | 'chevron-down' | 'logout' | 'phone'
  | 'search' | 'command' | 'help'
```

Passa a:

```ts
type IconName =
  | 'dashboard' | 'leads' | 'pipeline' | 'people' | 'building' | 'home'
  | 'calendar' | 'chart' | 'settings' | 'zap' | 'form' | 'mail'
  | 'whatsapp' | 'team' | 'plus' | 'pencil' | 'trash' | 'close'
  | 'send' | 'bell' | 'check' | 'x' | 'chevron-down' | 'logout' | 'phone'
  | 'search' | 'command' | 'help' | 'sun' | 'moon'
```

- [ ] **Step 2: Adicionar os paths ao mapa `PATHS`**

Depois da entrada `help: <>...</>,` (a última entrada do objeto `PATHS`, mesmo antes do `}` de fecho), adicionar:

```tsx
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  moon: <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />,
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 4: Commit**

```bash
git add components/ui/Icon.tsx
git commit -m "feat: icones sun e moon"
```

---

### Task 4: Paleta escura em `globals.css`

**Files:**
- Modify: `app/globals.css:55-69`

- [ ] **Step 1: Adicionar o bloco `[data-theme="dark"]`**

Imediatamente a seguir ao `}` que fecha o bloco `:root` (linha 55 atual, logo antes da linha em branco e de `html { scroll-behavior: smooth; }`), inserir:

```css

[data-theme="dark"] {
  /* Tema escuro quente — nunca preto puro, mesma lógica do claro */
  --bg: #1E1912;
  --surface: #262019;
  --card: #262019;
  --card-hover: #2E2720;
  --border: #3A3125;
  --border-strong: #4A3F2F;

  /* Marca — dourado mais claro para manter contraste no escuro */
  --gold: #C9A84C;
  --gold-bright: #E0C171;
  --gold-dim: #8C6B2E;
  --gold-glow: rgba(201,168,76,0.16);

  /* Texto */
  --text: #F2EDE3;
  --muted: #A69C8A;

  /* Status */
  --green: #34D399;
  --red: #F87171;
  --blue: #60A5FA;
  --purple: #A78BFA;
  --whatsapp: #25D366;

  /* Sombras — mais escuras, sem tinta castanha */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25);
  --shadow-md: 0 4px 14px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.25);
  --shadow-lg: 0 16px 40px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3);
}
```

- [ ] **Step 2: Adicionar transição suave ao `body`**

O bloco `body` atual (linhas 61-69):

```css
body {
  font-family: var(--font-body);
  font-size: var(--fs-base);
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-variant-numeric: tabular-nums;
}
```

Passa a (só a linha `background`/`color` ganham `transition`, resto igual):

```css
body {
  font-family: var(--font-body);
  font-size: var(--fs-base);
  background: var(--bg);
  color: var(--text);
  transition: background-color 0.25s var(--ease), color 0.25s var(--ease);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: paleta escura em globals.css"
```

---

### Task 5: Rota API `PATCH /api/users/me/theme`

**Files:**
- Create: `app/api/users/me/theme/route.ts`

- [ ] **Step 1: Escrever a rota**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (body.theme !== 'light' && body.theme !== 'dark') {
    return NextResponse.json({ error: 'Tema inválido.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('users')
    .update({ theme: body.theme })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ theme: body.theme })
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 3: Testar manualmente a rota**

Com o servidor de dev a correr e sessão autenticada (via browser, `fetch` na consola da página já autenticada — a rota depende de cookies de sessão):
- `PATCH /api/users/me/theme` com `{"theme":"dark"}` → 200, `{"theme":"dark"}`.
- `PATCH /api/users/me/theme` com `{"theme":"roxo"}` → 400 com `"Tema inválido."`.
- Confirmar via SQL (`select theme from users where id = '<user-id>'`) que ficou `dark`. Reverter para `light` no fim do teste (`update users set theme = 'light' where id = '<user-id>'`) para não deixar o teu próprio utilizador em estado inesperado antes da Task 10.

- [ ] **Step 4: Commit**

```bash
git add app/api/users/me/theme/route.ts
git commit -m "feat: API PATCH users/me/theme"
```

---

### Task 6: Layout raiz — ler cookie e pintar `data-theme`

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Substituir o ficheiro**

Conteúdo atual:

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'ImoFlow CRM',
  description: 'CRM Imobiliário para agências',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ImoFlow',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F7F5F0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
```

Passa a:

```tsx
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'ImoFlow CRM',
  description: 'CRM Imobiliário para agências',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ImoFlow',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F7F5F0',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value === 'dark' ? 'dark' : 'light'

  return (
    <html lang="pt" data-theme={theme} suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
```

`suppressHydrationWarning` no `<html>` evita o aviso do React caso o `ThemeToggle` (Task 8) corrija o atributo no cliente por o valor da base de dados ser diferente do cookie (primeiro acesso num dispositivo novo).

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: ler cookie de tema no layout raiz"
```

---

### Task 7: Layout `(app)` — buscar e passar `theme`

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Estender o `select` e passar a prop**

Conteúdo atual:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

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
    <AppShell
      userName={profile?.name ?? user.email ?? ''}
      userInitials={profile?.avatar_initials ?? 'XX'}
      userRole={profile?.role === 'admin' ? 'admin' : 'agent'}
    >
      {children}
    </AppShell>
  )
}
```

Passa a:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, avatar_initials, role, theme')
    .eq('id', user.id)
    .single()

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? ''}
      userInitials={profile?.avatar_initials ?? 'XX'}
      userRole={profile?.role === 'admin' ? 'admin' : 'agent'}
      userTheme={profile?.theme === 'dark' ? 'dark' : 'light'}
    >
      {children}
    </AppShell>
  )
}
```

- [ ] **Step 2: Verificar build**

Vai falhar nesta task, porque `AppShell` ainda não aceita `userTheme` — isso é normal, a Task 8 resolve. **Não correr o build isolado nesta task**; a verificação de build fica para o fim da Task 8, que já inclui esta alteração.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/layout.tsx"
git commit -m "feat: passar theme do perfil para AppShell"
```

---

### Task 8: `ThemeToggle` + integração no `AppShell`

**Files:**
- Create: `components/layout/ThemeToggle.tsx`
- Modify: `components/layout/AppShell.tsx`

- [ ] **Step 1: Criar `ThemeToggle`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'

type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`
}

type Props = {
  initialTheme: Theme
}

export function ThemeToggle({ initialTheme }: Props) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  // Reconcilia com a base de dados: se este dispositivo ainda não tem cookie
  // (ou tem um valor desatualizado), o valor vindo do servidor (fonte de
  // verdade entre dispositivos) prevalece.
  useEffect(() => {
    if (document.documentElement.dataset.theme !== initialTheme) {
      applyTheme(initialTheme)
      setTheme(initialTheme)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTheme])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
    fetch('/api/users/me/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {
      // dispositivo atual continua correto via cookie; só a sincronização
      // entre dispositivos fica por atualizar até à próxima escrita OK
    })
  }

  return (
    <button
      className="icon-btn"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
    </button>
  )
}
```

- [ ] **Step 2: Integrar no `AppShell`**

Conteúdo atual de `components/layout/AppShell.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { NotificationBell } from './NotificationBell'
import { CommandPalette } from '@/components/CommandPalette'
import { Icon } from '@/components/ui/Icon'

type Props = {
  children: React.ReactNode
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
}

export function AppShell({ children, userName, userInitials, userRole }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent))
  }, [])

  const openSearch = () => window.dispatchEvent(new CustomEvent('imoflow:open-cmdk'))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      <CommandPalette />
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar
        userName={userName}
        userInitials={userInitials}
        userRole={userRole}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="app-main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          gap: 12,
        }}>
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="5" x2="16" y2="5" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="13" x2="16" y2="13" />
            </svg>
          </button>
          <button className="search-trigger" onClick={openSearch} style={{ marginLeft: 'auto' }} aria-label="Pesquisar">
            <Icon name="search" size={14} />
            <span className="hide-mobile">Pesquisar…</span>
            <kbd className="hide-mobile">{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <NotificationBell />
        </header>
        {children}
      </main>
    </div>
  )
}
```

Passa a:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { CommandPalette } from '@/components/CommandPalette'
import { Icon } from '@/components/ui/Icon'

type Props = {
  children: React.ReactNode
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
  userTheme: 'light' | 'dark'
}

export function AppShell({ children, userName, userInitials, userRole, userTheme }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent))
  }, [])

  const openSearch = () => window.dispatchEvent(new CustomEvent('imoflow:open-cmdk'))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      <CommandPalette />
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar
        userName={userName}
        userInitials={userInitials}
        userRole={userRole}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="app-main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          gap: 12,
        }}>
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="5" x2="16" y2="5" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="13" x2="16" y2="13" />
            </svg>
          </button>
          <button className="search-trigger" onClick={openSearch} style={{ marginLeft: 'auto' }} aria-label="Pesquisar">
            <Icon name="search" size={14} />
            <span className="hide-mobile">Pesquisar…</span>
            <kbd className="hide-mobile">{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <ThemeToggle initialTheme={userTheme} />
          <NotificationBell />
        </header>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros (esta é a task que também valida a Task 7, que ficou pendente de build).

- [ ] **Step 4: Commit**

```bash
git add components/layout/ThemeToggle.tsx components/layout/AppShell.tsx
git commit -m "feat: botao ThemeToggle no cabecalho"
```

---

### Task 9: Corrigir cores fixas do `NotificationBell`

**Files:**
- Modify: `components/layout/NotificationBell.tsx`

- [ ] **Step 1: Substituir as cores hardcoded pelas variáveis de tema**

Substituições exatas a fazer no ficheiro (mantém toda a restante lógica/estrutura igual — só os valores de cor mudam):

| Antes | Depois | Onde |
|---|---|---|
| `background: '#ef4444'` | `background: 'var(--red)'` | badge de contagem não lida |
| `background: '#1A1A1E'` (contentor do dropdown) | `background: 'var(--surface)'` | dropdown |
| `border: '1px solid #262629'` (contentor do dropdown) | `border: '1px solid var(--border)'` | dropdown |
| `borderBottom: '1px solid #262629'` (cabeçalho do dropdown) | `borderBottom: '1px solid var(--border)'` | cabeçalho "Notificações" |
| `color: '#E8E4DC'` (título "Notificações") | `color: 'var(--text)'` | cabeçalho |
| `color: '#C9A84C'` ("Marcar todas como lidas") | `color: 'var(--gold-bright)'` | botão de marcar lidas |
| `color: '#7A7870'` (texto "Sem notificações") | `color: 'var(--muted)'` | estado vazio |
| `background: n.read ? '#1A1A1E' : 'rgba(201,168,76,0.08)'` | `background: n.read ? 'var(--surface)' : 'var(--gold-glow)'` | fundo de cada notificação (`--gold-glow` já é exatamente esta tinta dourada suave, definida em `globals.css`, usada para o mesmo efeito de destaque subtil noutros sítios da app) |
| `borderBottom: '1px solid #262629'` (item de notificação) | `borderBottom: '1px solid var(--border)'` | separador entre notificações |
| `color: '#E8E4DC'` (título da notificação) | `color: 'var(--text)'` | título |
| `color: '#7A7870'` (corpo da notificação) | `color: 'var(--muted)'` | corpo |
| `color: '#7A7870'` (timestamp) | `color: 'var(--muted)'` | "há X min" |

Ficheiro completo depois da alteração:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'new_lead' | 'task_due' | 'lead_stage_changed' | 'email_received'
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

const TYPE_ICONS: Record<Notification['type'], string> = {
  new_lead: '👤',
  task_due: '📋',
  lead_stage_changed: '🔄',
  email_received: '✉️',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  return `há ${Math.floor(hours / 24)}d`
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch {
      // silencioso — não bloquear a UI por falha de rede
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markAsRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  async function markAllAsRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) await markAsRead(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.25rem',
          position: 'relative',
          padding: '4px 8px',
        }}
        aria-label="Notificações"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'var(--red)',
            color: 'white',
            borderRadius: '9999px',
            fontSize: '0.65rem',
            fontWeight: 700,
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 8px)',
          width: '340px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          zIndex: 50,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>Notificações</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: 'var(--gold-bright)',
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                Sem notificações
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '12px 16px',
                    width: '100%',
                    textAlign: 'left',
                    background: n.read ? 'var(--surface)' : 'var(--gold-glow)',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{TYPE_ICONS[n.type]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: n.read ? 400 : 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                      {n.title}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.body}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: build passa sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/layout/NotificationBell.tsx
git commit -m "fix: NotificationBell usa variaveis de tema em vez de cores fixas"
```

---

### Task 10: Verificação manual — fim a fim

**Files:** nenhum (só verificação, browser preview)

- [ ] **Step 1: Arrancar o dev server e abrir a app autenticado**

Usar `preview_start` (servidor `imoflow-dev` já definido em `.claude/launch.json`, ou equivalente) e navegar para `/dashboard`.

Expected: app carrega no tema claro (comportamento por omissão, sem cookie ainda).

- [ ] **Step 2: Confirmar posição e aparência do botão**

Expected: um botão com ícone de sol aparece no cabeçalho, entre o campo de pesquisa e o sino de notificações.

- [ ] **Step 3: Alternar para escuro**

Clicar no botão.

Expected: toda a app muda instantaneamente para o tema escuro (fundo acastanhado escuro, texto claro, dourado mais brilhante) — incluindo o dropdown do sino de notificações (abrir o sino e confirmar que já não fica escuro-fixo dissonante, mas sim coerente com o resto da app agora escura). O ícone do botão muda para lua.

- [ ] **Step 4: Confirmar persistência ao recarregar**

Recarregar a página (`F5`/refresh).

Expected: app carrega já em tema escuro, sem flash de tema claro (o cookie já está definido).

- [ ] **Step 5: Confirmar gravação na base de dados**

Via SQL: `select theme from users where id = '<user-id-autenticado>'`.

Expected: `dark`.

- [ ] **Step 6: Confirmar sincronização entre "dispositivos" (sem cookie)**

Apagar o cookie `theme` deste browser (via devtools ou `document.cookie = 'theme=; path=/; max-age=0'` na consola) e recarregar a página autenticado.

Expected: a app aplica automaticamente o tema `dark` (valor da base de dados), mesmo sem o cookie — pode haver um único flash breve de claro→escuro nesse recarregamento específico, o que é esperado e aceitável segundo a spec.

- [ ] **Step 7: Voltar a claro e confirmar simetria**

Clicar no botão outra vez.

Expected: volta a claro, ícone muda para sol, base de dados atualiza para `light`.

- [ ] **Step 8: Confirmar visibilidade em mobile**

Usar `resize_window` (preset `mobile`, 375x812) e recarregar a página.

Expected: o botão de alternar tema continua visível no cabeçalho (é só ícone, sem texto, ao contrário do botão de pesquisa que esconde o texto "Pesquisar…" em mobile) e continua a funcionar ao clicar.