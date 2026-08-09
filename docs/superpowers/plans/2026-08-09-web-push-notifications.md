# Web Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send native push notifications (iOS PWA 16.4+ and Android) for `new_lead` and `task_due` events via the Web Push API with VAPID.

**Architecture:** Extend the existing `createNotification()` pipeline (which already sends email + Telegram) with a Web Push leg. Push subscriptions are stored per-device in Supabase. The existing service worker gains `push` and `notificationclick` handlers. A `PushBanner` component prompts first-time opt-in; a toggle on the Profile page lets users manage it afterwards.

**Tech Stack:** web-push (npm), Web Push API, Service Workers, Supabase (push_subscriptions table), Next.js API routes

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260809_push_subscriptions.sql` | DB table + RLS |
| Install | `web-push` npm package | Server-side push sending |
| Create | `lib/web-push.ts` | Configured web-push instance |
| Modify | `lib/notifications.ts` | Add push sending leg |
| Modify | `public/sw.js` | Add `push` + `notificationclick` handlers |
| Create | `app/api/push/subscribe/route.ts` | POST (subscribe) + DELETE (unsubscribe) |
| Create | `lib/push/client.ts` | Client helpers: subscribe, unsubscribe, check status |
| Create | `components/pwa/PushBanner.tsx` | First-time opt-in banner |
| Create | `components/profile/PushToggle.tsx` | Toggle on Profile page |
| Modify | `components/layout/AppShell.tsx` | Render PushBanner |
| Modify | `app/(app)/profile/page.tsx` | Render PushToggle |
| Modify | `app/manifest.ts` | Ensure `display: 'standalone'` (already set, no-op) |

---

### Task 1: Database migration — `push_subscriptions` table

**Files:**
- Create: `supabase/migrations/20260809_push_subscriptions.sql`

- [ ] **Step 1: Write migration file**

```sql
-- supabase/migrations/20260809_push_subscriptions.sql

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage their own push subscriptions"
  on public.push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- [ ] **Step 2: Apply migration**

Run via Supabase MCP `apply_migration` tool or:
```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260809_push_subscriptions.sql
git commit -m "feat: add push_subscriptions table with RLS"
```

---

### Task 2: Install `web-push` and generate VAPID keys

**Files:**
- Modify: `package.json`
- Create: `lib/web-push.ts`

- [ ] **Step 1: Install web-push**

```bash
npm install web-push
```

- [ ] **Step 2: Generate VAPID keys**

```bash
npx web-push generate-vapid-keys
```

Save the output. These will be added as environment variables:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — the public key (exposed to frontend)
- `VAPID_PRIVATE_KEY` — the private key (server only)

- [ ] **Step 3: Create `lib/web-push.ts`**

```typescript
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:tomasmsampaio@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export { webpush }
```

- [ ] **Step 4: Commit**

```bash
git add lib/web-push.ts package.json package-lock.json
git commit -m "feat: install web-push and configure VAPID"
```

---

### Task 3: Update service worker with push handlers

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Add push and notificationclick listeners to `public/sw.js`**

Append after the existing `fetch` listener:

```javascript
self.addEventListener('push', (event) => {
  if (!event.data) return
  const payload = event.data.json()
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: { link: payload.link },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link
  const urlToOpen = link ? new URL(link, self.location.origin).href : self.location.origin + '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus()
          client.navigate(urlToOpen)
          return
        }
      }
      return self.clients.openWindow(urlToOpen)
    })
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat: service worker push + notificationclick handlers"
```

---

### Task 4: API routes for subscribe/unsubscribe

**Files:**
- Create: `app/api/push/subscribe/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, agency_id: profile.agency_id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/push/subscribe/route.ts
git commit -m "feat: API routes for push subscribe/unsubscribe"
```

---

### Task 5: Add Web Push sending to `createNotification()`

**Files:**
- Modify: `lib/notifications.ts`

- [ ] **Step 1: Add push sending block after Telegram block**

Add import at top of `lib/notifications.ts`:

```typescript
import { webpush } from '@/lib/web-push'
```

Add this block after the Telegram block (after line 71, before the email check), inside `createNotification()`:

```typescript
  // 3b. Web Push (only for new_lead and task_due)
  if (type === 'new_lead' || type === 'task_due') {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (subs && subs.length > 0) {
      const payload = JSON.stringify({
        title,
        body,
        link,
        icon: '/icon-192.png',
      })

      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
          } catch (err: any) {
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
            console.error('Push send failed:', err?.statusCode ?? err)
          }
        })
      )
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: send web push for new_lead and task_due notifications"
```

---

### Task 6: Client-side push helpers

**Files:**
- Create: `lib/push/client.ts`

- [ ] **Step 1: Create the client helpers file**

```typescript
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const subJSON = sub.toJSON()
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subJSON.endpoint, keys: subJSON.keys }),
  })

  return sub
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getPushSubscription()
  if (!sub) return

  const endpoint = sub.endpoint
  await sub.unsubscribe()

  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/push/client.ts
git commit -m "feat: client-side push subscribe/unsubscribe helpers"
```

---

### Task 7: PushBanner component

**Files:**
- Create: `components/pwa/PushBanner.tsx`
- Modify: `components/layout/AppShell.tsx`

- [ ] **Step 1: Create `components/pwa/PushBanner.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { isPushSupported, getPushSubscription, subscribeToPush } from '@/lib/push/client'

export function PushBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (localStorage.getItem('push_banner_dismissed')) return
    if (Notification.permission === 'denied') return

    getPushSubscription().then((sub) => {
      if (!sub) setVisible(true)
    })
  }, [])

  async function handleActivate() {
    const sub = await subscribeToPush()
    if (sub) {
      setVisible(false)
    } else {
      localStorage.setItem('push_banner_dismissed', '1')
      setVisible(false)
    }
  }

  function handleDismiss() {
    localStorage.setItem('push_banner_dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      background: 'var(--gold-glow)',
      borderBottom: '1px solid rgba(176,125,46,0.3)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--text)',
    }}>
      <span style={{ flex: 1 }}>Ative notificações para não perder novos leads e tarefas</span>
      <button
        onClick={handleActivate}
        className="btn btn-gold"
        style={{ padding: '5px 14px', fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}
      >
        Ativar
      </button>
      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '0 4px' }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add PushBanner to AppShell**

In `components/layout/AppShell.tsx`, add import:

```typescript
import { PushBanner } from '@/components/pwa/PushBanner'
```

Render `<PushBanner />` right after the `</header>` closing tag and before `{children}`:

```tsx
        </header>
        <PushBanner />
        {children}
```

- [ ] **Step 3: Commit**

```bash
git add components/pwa/PushBanner.tsx components/layout/AppShell.tsx
git commit -m "feat: PushBanner opt-in component in AppShell"
```

---

### Task 8: PushToggle on Profile page

**Files:**
- Create: `components/profile/PushToggle.tsx`
- Modify: `app/(app)/profile/page.tsx`

- [ ] **Step 1: Create `components/profile/PushToggle.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { isPushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/push/client'

type Status = 'loading' | 'active' | 'inactive' | 'denied' | 'unsupported'

export function PushToggle() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!isPushSupported()) { setStatus('unsupported'); return }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    getPushSubscription().then((sub) => setStatus(sub ? 'active' : 'inactive'))
  }, [])

  async function toggle() {
    if (status === 'active') {
      await unsubscribeFromPush()
      setStatus('inactive')
    } else {
      const sub = await subscribeToPush()
      setStatus(sub ? 'active' : Notification.permission === 'denied' ? 'denied' : 'inactive')
    }
  }

  const labels: Record<Status, string> = {
    loading: 'A verificar…',
    active: 'Ativas neste dispositivo',
    inactive: 'Desativadas',
    denied: 'Bloqueadas pelo browser',
    unsupported: 'Não suportado neste browser',
  }

  const canToggle = status === 'active' || status === 'inactive'

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="font-display" style={{ fontSize: 'var(--fs-md)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        Notificações Push
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text)' }}>Notificações neste dispositivo</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 4 }}>{labels[status]}</div>
          {status === 'denied' && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 4 }}>
              Para ativar, permita notificações nas definições do browser para este site.
            </div>
          )}
        </div>
        {canToggle && (
          <button
            onClick={toggle}
            className={status === 'active' ? 'btn' : 'btn btn-gold'}
            style={{ padding: '6px 16px', fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}
          >
            {status === 'active' ? 'Desativar' : 'Ativar'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add PushToggle to Profile page**

In `app/(app)/profile/page.tsx`, add import and render after CalendarFeedCard:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CalendarFeedCard } from '@/components/profile/CalendarFeedCard'
import { PushToggle } from '@/components/profile/PushToggle'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="page-enter page-pad" style={{ padding: '24px 32px' }}>
      <h2 className="font-display" style={{ fontSize: 20, marginBottom: 20 }}>O meu perfil</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PushToggle />
        <CalendarFeedCard />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/profile/PushToggle.tsx app/\(app\)/profile/page.tsx
git commit -m "feat: push notification toggle on Profile page"
```

---

### Task 9: Environment variables and final verification

**Files:** None (configuration only)

- [ ] **Step 1: Add env vars to `.env.local`**

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key from Task 2>
VAPID_PRIVATE_KEY=<private key from Task 2>
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: no build errors.

- [ ] **Step 3: Manual verification checklist**

1. Open the app in the browser
2. Verify PushBanner appears at the top
3. Click "Ativar" — browser should prompt for notification permission
4. Grant permission — banner should disappear
5. Go to Profile page — toggle should show "Ativas neste dispositivo"
6. Click "Desativar" — toggle should switch to "Desativadas"
7. Dismiss the banner instead — it should not reappear after reload

- [ ] **Step 4: Add env vars to Vercel**

Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to the Vercel project's environment variables.

- [ ] **Step 5: Commit any remaining changes and push**

```bash
git push origin HEAD
```
