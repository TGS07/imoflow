# ImoFlow 2.0 — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade ImoFlow to v2.0 with refined visual design, top navigation bar, improved pipeline/calendar, and new features (uploads, landing page, billing, onboarding, XML feed, client portal).

**Architecture:** Foundation First — build the design system and UI components, then apply them to navigation and existing pages, then build new features. Each phase is an independent plan that produces working software.

**Tech Stack:** Next.js 16, React 19, Supabase (DB + Auth + Storage), Tailwind CSS v4, Stripe, Recharts, @dnd-kit

---

## Phase Overview

| Phase | Name | Description | Depends on |
|-------|------|-------------|------------|
| 1 | Design System | UI component library, CSS tokens, animations | — |
| 2 | Navigation | Top bar, breadcrumbs, mobile bottom tabs | Phase 1 |
| 3 | Page Redesign | Dashboard, Pipeline, Calendar, all pages with new components | Phase 2 |
| 4 | Upload & Storage | Photo/document upload with Supabase Storage | Phase 1 |
| 5 | Landing Page & Auth | Public landing page, sign-up flow | Phase 1 |
| 6 | Billing | Stripe integration, plan limits, upgrade flow | Phase 5 |
| 7 | Onboarding | Guided wizard for first-time users | Phase 3 |
| 8 | XML Feed | Property export feed for real estate portals | Phase 4 |
| 9 | Client Portal | Public portal per lead with property recommendations | Phase 4, 6 |
| 10 | Technical Cleanup | Remove legacy code, fix types, error boundaries | Phase 3 |

Each phase has its own detailed plan document below.

---

## Phase 1: Design System

### Task 1.1: Design Tokens — Update CSS Variables

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Update typography scale**

Change `--fs-base: 13px` to `14px` and adjust the full scale:

```css
--fs-2xs: 10px;
--fs-xs: 11px;
--fs-sm: 12px;
--fs-base: 14px;
--fs-md: 16px;
--fs-lg: 20px;
--fs-xl: 24px;
--fs-2xl: 30px;
--fs-3xl: 36px;
```

- [ ] **Step 2: Add spacing scale tokens**

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
--space-16: 64px;
```

- [ ] **Step 3: Update border radius tokens**

```css
--radius: 14px;
--radius-sm: 10px;
--radius-pill: 20px;
--radius-full: 9999px;
```

- [ ] **Step 4: Add elevation tokens**

```css
--elevation-1: 0 0 0 1px rgba(176,125,46,0.08), 0 1px 3px rgba(84,62,26,0.06);
--elevation-2: 0 0 0 1px rgba(176,125,46,0.06), 0 4px 14px rgba(84,62,26,0.09);
--elevation-3: 0 0 0 1px rgba(176,125,46,0.04), 0 16px 40px rgba(60,44,18,0.13);
```

Add dark mode equivalents in `[data-theme="dark"]`.

- [ ] **Step 5: Add gradient and highlight tokens**

```css
--gold-gradient: linear-gradient(135deg, #B07D2E 0%, #C9A84C 100%);
--gold-gradient-shadow: 0 4px 12px rgba(176,125,46,0.25);
--item-bg: #FAF8F3;
```

Dark mode:
```css
--item-bg: #2E2720;
```

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "feat: update design tokens for ImoFlow 2.0 — typography, spacing, radius, elevation"
```

---

### Task 1.2: Button Component

**Files:**
- Create: `components/ui/Button.tsx`

- [ ] **Step 1: Create Button component**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'soft' | 'danger' | 'whatsapp'
type ButtonSize = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', children, loading, className, disabled, ...rest }: Props) {
  return (
    <button
      className={`btn btn-${variant} btn-size-${size} ${className ?? ''}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="btn-spinner" />}
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Add Button CSS to globals.css**

Add button styles using the new tokens — `.btn` base, `.btn-primary`, `.btn-ghost`, `.btn-soft`, `.btn-danger`, `.btn-whatsapp`, `.btn-size-sm/md/lg`, `.btn-spinner` animation. Replace the existing `.btn-primary`, `.btn-ghost` etc. classes that are already in globals.css.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Button.tsx app/globals.css
git commit -m "feat: add Button component with variants and sizes"
```

---

### Task 1.3: Card Component

**Files:**
- Create: `components/ui/Card.tsx`

- [ ] **Step 1: Create Card component**

```tsx
import type { ReactNode, HTMLAttributes } from 'react'

type CardVariant = 'default' | 'stat' | 'highlight' | 'interactive'

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant
  children: ReactNode
}

export function Card({ variant = 'default', children, className, ...rest }: Props) {
  return (
    <div className={`card card-${variant} ${className ?? ''}`} {...rest}>
      {children}
    </div>
  )
}

type StatCardProps = {
  label: string
  value: string | number
  change?: { value: string; positive: boolean }
  highlight?: boolean
}

export function StatCard({ label, value, change, highlight }: StatCardProps) {
  return (
    <Card variant={highlight ? 'highlight' : 'stat'}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {change && (
        <span className={`stat-change ${change.positive ? 'positive' : 'negative'}`}>
          {change.value}
        </span>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Add Card CSS**

Add to `globals.css`: `.card` base with `elevation-1`, `.card-stat`, `.card-highlight` (uses `--gold-gradient`), `.card-interactive` (hover with `elevation-2` + `scale(1.01)`), `.stat-label`, `.stat-value`, `.stat-change` pill badges.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Card.tsx app/globals.css
git commit -m "feat: add Card and StatCard components"
```

---

### Task 1.4: Badge Component

**Files:**
- Create: `components/ui/Badge.tsx`

- [ ] **Step 1: Create Badge component**

```tsx
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold'

type Props = {
  variant?: BadgeVariant
  children: React.ReactNode
  size?: 'sm' | 'md'
}

export function Badge({ variant = 'neutral', size = 'md', children }: Props) {
  return (
    <span className={`badge badge-${variant} badge-${size}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 2: Add Badge CSS**

Pill badges with soft background + strong text color for each variant. Size `sm` is 10px font, `md` is 12px.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Badge.tsx app/globals.css
git commit -m "feat: add Badge pill component"
```

---

### Task 1.5: Input Component

**Files:**
- Create: `components/ui/Input.tsx`

- [ ] **Step 1: Create Input, Select, Textarea components**

Create `Input` (text, search, date), `Select`, and `Textarea` components with consistent styling using the new tokens. Include a `label` prop and error state.

- [ ] **Step 2: Add Input CSS**

`.input-field` base with `--radius-sm`, focus state with `--gold` outline, error state with `--red`. `.input-label` with `--fs-sm` uppercase. `.input-search` with search icon.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Input.tsx app/globals.css
git commit -m "feat: add Input, Select, Textarea components"
```

---

### Task 1.6: Modal Component

**Files:**
- Create: `components/ui/Modal.tsx`

- [ ] **Step 1: Create Modal component**

```tsx
'use client'
import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  variant?: 'default' | 'slide-over' | 'bottom-sheet'
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, variant = 'default', size = 'md' }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal-${variant} modal-${size}`}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {title && (
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
      )}
      <div className="modal-body">{children}</div>
    </dialog>
  )
}
```

- [ ] **Step 2: Add Modal CSS**

`.modal` with backdrop blur, `scaleIn` animation. `.modal-slide-over` slides from right. `.modal-bottom-sheet` slides from bottom (mobile). Sizes control max-width.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Modal.tsx app/globals.css
git commit -m "feat: add Modal component with slide-over and bottom-sheet variants"
```

---

### Task 1.7: Toast Notification System

**Files:**
- Create: `components/ui/Toast.tsx`
- Create: `lib/toast.ts`

- [ ] **Step 1: Create toast store**

Simple event-based toast system in `lib/toast.ts` using a custom event pattern:

```ts
type ToastType = 'success' | 'error' | 'info' | 'warning'

export function toast(message: string, type: ToastType = 'info') {
  window.dispatchEvent(new CustomEvent('imoflow:toast', { detail: { message, type, id: Date.now() } }))
}
```

- [ ] **Step 2: Create Toast container component**

`Toast.tsx` — listens for custom events, renders toasts in top-right corner with slide-in animation, auto-dismiss after 4 seconds. Each toast has icon, message, and close button.

- [ ] **Step 3: Add Toast to root layout**

Add `<ToastContainer />` to `components/layout/AppShell.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/ui/Toast.tsx lib/toast.ts components/layout/AppShell.tsx app/globals.css
git commit -m "feat: add toast notification system"
```

---

### Task 1.8: Skeleton Component

**Files:**
- Create: `components/ui/Skeleton.tsx`

- [ ] **Step 1: Create Skeleton components**

```tsx
type Props = {
  variant?: 'text' | 'card' | 'table-row' | 'avatar'
  width?: string
  height?: string
  count?: number
}

export function Skeleton({ variant = 'text', width, height, count = 1 }: Props) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skeleton skeleton-${variant}`} style={{ width, height }} />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Add Skeleton CSS with shimmer animation**

- [ ] **Step 3: Commit**

```bash
git add components/ui/Skeleton.tsx app/globals.css
git commit -m "feat: add Skeleton loading component with shimmer"
```

---

### Task 1.9: Avatar and Dropdown Components

**Files:**
- Create: `components/ui/Avatar.tsx`
- Create: `components/ui/Dropdown.tsx`

- [ ] **Step 1: Create Avatar component**

Circular component with image or initials. Initials background color derived from name hash (consistent color per person).

- [ ] **Step 2: Create Dropdown component**

Trigger + popover menu. Uses `<details>/<summary>` or state-based. Click outside to close. Supports menu items with icons.

- [ ] **Step 3: Add CSS for both**

- [ ] **Step 4: Commit**

```bash
git add components/ui/Avatar.tsx components/ui/Dropdown.tsx app/globals.css
git commit -m "feat: add Avatar and Dropdown components"
```

---

## Phase 2: Navigation — Top Bar

### Task 2.1: Create TopNav Component

**Files:**
- Create: `components/layout/TopNav.tsx`

- [ ] **Step 1: Create TopNav component**

Replace the sidebar with a horizontal top navigation bar. Dark background (`#1E1912`), logo left, nav links center, actions right (search, notifications, settings dropdown, avatar).

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, IconName } from '@/components/ui/Icon'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import { Dropdown } from '@/components/ui/Dropdown'

const navItems: { href: string; icon: IconName; label: string }[] = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/pipeline', icon: 'pipeline', label: 'Pipeline' },
  { href: '/activities', icon: 'calendar', label: 'Atividades' },
  { href: '/people', icon: 'people', label: 'Contactos' },
  { href: '/properties', icon: 'home', label: 'Imóveis' },
  { href: '/reports', icon: 'chart', label: 'Relatórios' },
]

type Props = {
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
}

export function TopNav({ userName, userInitials, userRole }: Props) {
  const pathname = usePathname()

  const openSearch = () => window.dispatchEvent(new CustomEvent('imoflow:open-cmdk'))

  return (
    <nav className="topnav">
      <div className="topnav-left">
        <Link href="/dashboard" className="topnav-logo">
          <div className="topnav-logo-mark">IF</div>
          <span className="topnav-logo-text font-display">ImoFlow</span>
        </Link>
        <div className="topnav-links">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`topnav-link ${pathname.startsWith(item.href) ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="topnav-right">
        <button className="topnav-search" onClick={openSearch}>
          <Icon name="search" size={14} />
          <span>Pesquisar...</span>
          <kbd>⌘K</kbd>
        </button>
        <NotificationBell />
        {userRole === 'admin' && (
          <Dropdown
            trigger={<button className="topnav-icon-btn"><Icon name="settings" size={18} /></button>}
            items={[
              { href: '/settings/pipeline', label: 'Pipeline', icon: 'pipeline' },
              { href: '/settings/automations', label: 'Automações', icon: 'zap' },
              { href: '/settings/forms', label: 'Formulários', icon: 'form' },
              { href: '/settings/templates', label: 'Templates', icon: 'mail' },
              { href: '/settings/agency', label: 'Agência', icon: 'building' },
              { href: '/settings/team', label: 'Equipa', icon: 'team' },
              { href: '/settings/siglas', label: 'Siglas', icon: 'form' },
              { href: '/help', label: 'Ajuda', icon: 'help' },
            ]}
          />
        )}
        <ThemeToggle />
        <Link href="/profile" className="topnav-avatar">
          <Avatar name={userName} initials={userInitials} size={28} />
        </Link>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Add TopNav CSS to globals.css**

`.topnav` — dark background, flex row, height ~48px, sticky top. `.topnav-link.active` — gold background. `.topnav-search` — styled input-like button. Media query: hide link labels below 1024px (icons only). Hide topnav below 768px.

- [ ] **Step 3: Commit**

```bash
git add components/layout/TopNav.tsx app/globals.css
git commit -m "feat: create TopNav horizontal navigation component"
```

---

### Task 2.2: Create Breadcrumbs Component

**Files:**
- Create: `components/layout/Breadcrumbs.tsx`

- [ ] **Step 1: Create Breadcrumbs component**

Auto-generates breadcrumbs from pathname. Maps route segments to labels (dashboard → Dashboard, people → Contactos, etc). Supports dynamic segments (ids replaced with entity name via optional `title` prop).

- [ ] **Step 2: Add Breadcrumbs CSS**

Subtle bar below topnav, small font, `>` separator, last item is active.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Breadcrumbs.tsx app/globals.css
git commit -m "feat: add Breadcrumbs navigation component"
```

---

### Task 2.3: Create MobileNav Component

**Files:**
- Create: `components/layout/MobileNav.tsx`

- [ ] **Step 1: Create MobileNav bottom tab bar**

5 fixed tabs at bottom: Dashboard, Pipeline, Atividades, Contactos, Mais. "Mais" opens a bottom sheet with Imóveis, Relatórios, Settings, Help. Only visible below 768px.

- [ ] **Step 2: Add MobileNav CSS**

Fixed bottom, height ~56px, icons + small labels, active state with gold color. `.mobile-more-sheet` as a bottom sheet overlay.

- [ ] **Step 3: Commit**

```bash
git add components/layout/MobileNav.tsx app/globals.css
git commit -m "feat: add MobileNav bottom tab bar"
```

---

### Task 2.4: Replace AppShell Layout

**Files:**
- Modify: `components/layout/AppShell.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Refactor AppShell**

Remove Sidebar import. Add TopNav, Breadcrumbs, MobileNav. Content area uses 100% width.

```tsx
'use client'
import { TopNav } from './TopNav'
import { Breadcrumbs } from './Breadcrumbs'
import { MobileNav } from './MobileNav'
import { CommandPalette } from '@/components/CommandPalette'
import { ToastContainer } from '@/components/ui/Toast'
import { PushBanner } from '@/components/pwa/PushBanner'

type Props = {
  children: React.ReactNode
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
  userTheme: 'light' | 'dark'
}

export function AppShell({ children, userName, userInitials, userRole, userTheme }: Props) {
  return (
    <div className="app-layout">
      <CommandPalette />
      <ToastContainer />
      <PushBanner />
      <TopNav userName={userName} userInitials={userInitials} userRole={userRole} />
      <Breadcrumbs />
      <main className="app-content">
        {children}
      </main>
      <MobileNav userRole={userRole} />
    </div>
  )
}
```

- [ ] **Step 2: Update CSS**

`.app-layout` — flex column, min-height 100vh. `.app-content` — flex 1, padding, overflow-y auto. Remove old sidebar CSS (`.sidebar-desktop`, `.sidebar-overlay`, etc).

- [ ] **Step 3: Remove Sidebar.tsx**

Delete `components/layout/Sidebar.tsx` — no longer used.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace sidebar with top navigation bar, breadcrumbs, and mobile bottom tabs"
```

---

## Phase 3: Page Redesign

### Task 3.1: Dashboard Redesign

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `components/dashboard/StatCard.tsx` (replace with new `Card` component)

- [ ] **Step 1: Redesign dashboard layout**

Replace current inline-styled dashboard with new components:
- 4 StatCards in a row (highlight card for Pipeline value with gold gradient)
- Grid layout: "Hoje" (left) + "Funil de Vendas" (right), "Follow-ups" (left) + "Evolução Semanal" (right)
- Use `Card`, `Badge`, `Avatar` components throughout
- Add previsão de fecho: sum of (deal_value × probability) for active leads

- [ ] **Step 2: Replace old StatCard with new one**

Update imports to use `StatCard` from `components/ui/Card.tsx`. Remove old `components/dashboard/StatCard.tsx` if fully replaced.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: redesign dashboard with new design system components"
```

---

### Task 3.2: Pipeline Cards Redesign

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`
- Modify: `components/pipeline/PipelineBoard.tsx`

- [ ] **Step 1: Redesign kanban cards**

Update card rendering to include:
- Property photo thumbnail (left side, 48x48 rounded)
- Name bold 14px, zone + typology muted 12px
- Deal value in gold bold 16px
- Days-in-stage pill: green (<7d), amber (7-14d), red (>14d)
- Agent avatar bottom-right (24px)
- Quick action icons on hover (move, edit, WhatsApp, schedule)

- [ ] **Step 2: Replace inline styles with CSS classes**

Move all card styling from inline to `.kanban-card`, `.kanban-card-thumb`, `.kanban-card-info`, `.kanban-card-value`, `.kanban-card-days`, `.kanban-card-actions`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: redesign pipeline cards with thumbnails, badges, and quick actions"
```

---

### Task 3.3: Pipeline Configuration Improvements

**Files:**
- Modify: `app/(app)/settings/pipeline/page.tsx`
- Modify: `components/pipeline/PipelineSettingsModal.tsx`

- [ ] **Step 1: Add inline editing for stage names**

Replace modal-based name editing with click-to-edit inline input on stage names.

- [ ] **Step 2: Improve color picker**

Replace text-based color input with a visual palette of predefined colors with preview swatch.

- [ ] **Step 3: Add pipeline templates**

When creating a new pipeline, offer 3 templates: "Vendas" (Novo Lead → Contacto → Visita → Proposta → Negociação → Ganho/Perdido), "Arrendamento" (Novo → Visita → Documentação → Contrato → Ativo/Cancelado), "Compra" (Prospeção → Análise → Proposta → Escritura → Concluído/Cancelado).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: improve pipeline config — inline editing, visual color picker, templates"
```

---

### Task 3.4: Calendar/Activities Improvements

**Files:**
- Modify: `app/(app)/activities/page.tsx`
- Modify: `components/activities/CalendarTimeGrid.tsx`

- [ ] **Step 1: Add quick-add floating button**

Add a "+" floating action button (FAB) bottom-right that opens a simplified creation form: type dropdown + title input + date/time picker. 3 clicks to create.

- [ ] **Step 2: Add "Agendar" buttons to entity pages**

Add "Agendar atividade" button to lead detail (`app/(app)/leads/[id]/page.tsx`), person detail (`app/(app)/people/[id]/page.tsx`), and property detail (`app/(app)/properties/[id]/page.tsx`). Each pre-fills the entity association.

- [ ] **Step 3: Improve time grid**

Make 30-min slots clickable to create activity at that time. Show activities as colored blocks by type.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: improve calendar — quick-add FAB, contextual scheduling, clickable time grid"
```

---

### Task 3.5: Migrate All Pages to New Design System

**Files:**
- Modify: All page files under `app/(app)/` and their components

- [ ] **Step 1: Leads page** — Replace inline styles with Card, Badge, Button, Input components. Use new elevation and spacing tokens.

- [ ] **Step 2: People/Contacts page** — Same treatment. Tab for Organizações sub-section.

- [ ] **Step 3: Properties page** — Same treatment. Property cards with new Card component.

- [ ] **Step 4: Reports page** — Same treatment. Use StatCard for KPIs, interactive charts.

- [ ] **Step 5: Settings pages** — Replace all inline styles. Use new Input, Button, Card components.

- [ ] **Step 6: Lead/Person/Property detail pages** — Full redesign with new components, consistent layout.

- [ ] **Step 7: Commit after each page (not all at once)**

Each page gets its own commit: `feat: redesign [page] with v2 design system`.

---

## Phase 4: Upload & Storage

### Task 4.1: Setup Supabase Storage Buckets

**Files:**
- Create: `lib/supabase/storage.ts`

- [ ] **Step 1: Create storage utility functions**

Helper functions for uploading, listing, deleting files from Supabase Storage. Functions: `uploadFile(bucket, path, file)`, `getPublicUrl(bucket, path)`, `deleteFile(bucket, path)`, `listFiles(bucket, prefix)`.

- [ ] **Step 2: Create Supabase Storage buckets via migration**

SQL migration to create buckets `property-photos` and `documents` with RLS policies scoped to agency_id.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: setup Supabase Storage buckets and utility functions"
```

---

### Task 4.2: Property Photo Upload

**Files:**
- Create: `components/properties/PhotoGallery.tsx`
- Modify: `app/(app)/properties/[id]/page.tsx`
- Create: `app/api/properties/[id]/photos/route.ts`

- [ ] **Step 1: Create PhotoGallery component**

Drag-and-drop zone, thumbnail grid, reorder by drag, select cover photo, delete. Client-side compression before upload (max 2MB). Lightbox for full view.

- [ ] **Step 2: Create API route for photo management**

POST (upload), DELETE (remove), PATCH (reorder/set cover).

- [ ] **Step 3: Integrate into property detail page**

Add PhotoGallery section to property detail page, replacing the manual URL array.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add property photo upload with gallery, drag-reorder, and lightbox"
```

---

### Task 4.3: Document Upload

**Files:**
- Create: `components/shared/DocumentList.tsx`
- Create: `app/api/documents/route.ts`
- Create: `app/api/documents/[id]/route.ts`

- [ ] **Step 1: Create documents table migration**

Table `documents`: id, agency_id, entity_type (lead/person/property), entity_id, name, file_path, file_type, file_size, uploaded_by, created_at. RLS by agency_id.

- [ ] **Step 2: Create DocumentList component**

List with icon per file type, name, date, size. Upload button with drag-and-drop. Delete with confirmation. Inline preview for PDFs and images.

- [ ] **Step 3: Create API routes**

GET (list by entity), POST (upload), DELETE.

- [ ] **Step 4: Integrate into lead, person, and property detail pages**

Add DocumentList section to each detail page.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add document upload system for leads, contacts, and properties"
```

---

## Phase 5: Landing Page & Auth

### Task 5.1: Landing Page

**Files:**
- Create: `app/(public)/landing/page.tsx` (or modify `app/page.tsx`)
- Create: `components/landing/Hero.tsx`
- Create: `components/landing/Features.tsx`
- Create: `components/landing/Pricing.tsx`
- Create: `components/landing/Footer.tsx`

- [ ] **Step 1: Create landing page sections**

Hero with title, subtitle, CTA, dashboard mockup image. Features grid with icons. Pricing table (Free vs Pro). Footer with legal links.

- [ ] **Step 2: Update root page.tsx**

Authenticated users → redirect to `/dashboard`. Unauthenticated → show landing page.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add public landing page with hero, features, and pricing"
```

---

### Task 5.2: Sign-Up Flow

**Files:**
- Create: `app/signup/page.tsx`
- Create: `app/api/signup/route.ts`

- [ ] **Step 1: Create sign-up page**

Form: name, email, password, agency name. On submit: create Supabase auth user, create agency row, create user row with role admin.

- [ ] **Step 2: Create API route**

Uses Supabase service_role to create auth user + agency + user in a transaction.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add public sign-up flow for new agencies"
```

---

## Phase 6: Billing (Stripe)

### Task 6.1: Stripe Setup

**Files:**
- Create: `lib/stripe/client.ts`
- Create: `lib/stripe/plans.ts`
- Create: `app/api/billing/checkout/route.ts`
- Create: `app/api/billing/portal/route.ts`
- Create: `app/api/billing/webhook/route.ts`

- [ ] **Step 1: Install Stripe SDK**

```bash
npm install stripe
```

- [ ] **Step 2: Create Stripe utilities**

`client.ts` — Stripe instance. `plans.ts` — plan definitions with limits (leads, contacts, properties, members, storage, automations).

- [ ] **Step 3: Create checkout API route**

Creates a Stripe Checkout Session for upgrading to Pro.

- [ ] **Step 4: Create portal API route**

Creates a Stripe Customer Portal session for managing subscription.

- [ ] **Step 5: Create webhook route**

Handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Updates agency `plan` field.

- [ ] **Step 6: Add plan limit checks**

Create `lib/stripe/limits.ts` — `checkLimit(agencyId, resource)` function that checks current usage against plan limits. Call before creating leads/contacts/properties in API routes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Stripe billing — checkout, portal, webhooks, plan limits"
```

---

### Task 6.2: Billing Settings Page

**Files:**
- Create: `app/(app)/settings/billing/page.tsx`

- [ ] **Step 1: Create billing page**

Show current plan, usage stats (leads used / limit), upgrade CTA for free plan, manage subscription button for pro plan. Add to settings dropdown in TopNav.

- [ ] **Step 2: Add upgrade banner component**

Banner shown when approaching 80% of a limit. "Está a chegar ao limite de X. Upgrade para Pro para continuar."

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add billing settings page with usage stats and upgrade flow"
```

---

## Phase 7: Onboarding

### Task 7.1: Onboarding Wizard

**Files:**
- Create: `components/onboarding/OnboardingWizard.tsx`
- Create: `app/(app)/onboarding/page.tsx`

- [ ] **Step 1: Create wizard component**

4-step wizard with horizontal stepper: Agência (name, email, logo upload) → Pipeline (choose template or custom) → Primeiro Contacto (simplified form) → Equipa (invite by email, skip option).

Each step can be skipped. Progress saved to agency metadata.

- [ ] **Step 2: Create onboarding page**

Full-screen wizard (no topnav). Redirect here on first login if onboarding not completed.

- [ ] **Step 3: Add onboarding checklist to dashboard**

"Complete o seu setup" card on dashboard showing pending steps. Dismiss when all done.

- [ ] **Step 4: Add onboarding_completed flag**

Add `onboarding_completed` boolean to `agencies` table via migration. Check in app layout to redirect.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add guided onboarding wizard with 4 steps and dashboard checklist"
```

---

## Phase 8: XML Feed for Portals

### Task 8.1: Property XML Feed

**Files:**
- Create: `app/api/feed/[token]/route.ts`
- Create: `lib/feed/xml-generator.ts`
- Modify: `app/(app)/settings/agency/page.tsx`

- [ ] **Step 1: Add feed_token to agencies table**

Migration: `ALTER TABLE agencies ADD COLUMN feed_token UUID DEFAULT gen_random_uuid()`.

- [ ] **Step 2: Create XML generator**

Function that takes an array of properties and outputs XML compatible with CASA SAPO format: `<property>` elements with reference, title, type, price, area, typology, bedrooms, bathrooms, photos, description, address, coordinates.

- [ ] **Step 3: Create feed API route**

GET `/api/feed/[token]` — look up agency by token, fetch active properties (with photos from Storage), generate XML, return with `Content-Type: application/xml`.

- [ ] **Step 4: Add feed settings UI**

In agency settings, show the feed URL. Button to regenerate token. Note that this requires Pro plan.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add property XML feed for real estate portal integration"
```

---

## Phase 9: Client Portal

### Task 9.1: Client Portal

**Files:**
- Create: `app/(public)/portal/[token]/page.tsx`
- Create: `components/portal/PortalView.tsx`
- Create: `app/api/portal/[token]/route.ts`
- Modify: Lead detail page (add portal link generation)

- [ ] **Step 1: Add portal_token to leads table**

Migration: `ALTER TABLE leads ADD COLUMN portal_token UUID DEFAULT NULL`. Token generated when agent activates portal for a lead.

- [ ] **Step 2: Create portal API route**

GET — returns lead info, recommended properties (with photos), pipeline progress (simplified), agent message.

- [ ] **Step 3: Create portal page**

Public page with agency branding (logo, name). Cards for recommended properties with photos. Progress bar showing pipeline stage. Contact agent button. Mark favorites functionality.

- [ ] **Step 4: Create portal activity tracking**

Table `portal_views`: id, lead_id, property_id (nullable), action (view/favorite/request_visit), created_at. Record when client views properties or takes actions.

- [ ] **Step 5: Add portal controls to lead detail**

Button "Ativar portal" → generates token and shows shareable link. "Ver atividade" shows what the client did on the portal.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add client portal with property recommendations and activity tracking"
```

---

## Phase 10: Technical Cleanup

### Task 10.1: Remove Legacy Code

**Files:**
- Delete: `components/layout/Sidebar.tsx` (if not already deleted in Phase 2)
- Delete: `docs/TELEGRAM_SETUP.md`
- Modify: Remove `lib/telegram/` directory
- Modify: Remove `temperature` field references from `types/contact.ts`

- [ ] **Step 1: Remove Sidebar.tsx if still exists**
- [ ] **Step 2: Remove Telegram code and docs**
- [ ] **Step 3: Remove deprecated `temperature` field from types and any references**
- [ ] **Step 4: Remove `tasks` table API routes if fully replaced by activities**

Check `app/api/tasks/` — if `activities` covers all use cases, remove tasks routes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove legacy code — Sidebar, Telegram, deprecated fields, tasks API"
```

---

### Task 10.2: Fix Type Safety

**Files:**
- Modify: Various components with `as unknown as` casting

- [ ] **Step 1: Generate Supabase types**

```bash
npx supabase gen types typescript --project-id $PROJECT_ID > types/database.ts
```

- [ ] **Step 2: Replace `as unknown as` casts**

Search for all `as unknown as` in components and replace with properly typed Supabase queries using the generated types.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: replace type casts with generated Supabase types"
```

---

### Task 10.3: Error Boundaries

**Files:**
- Create: `components/ui/ErrorBoundary.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Create ErrorBoundary component**

React error boundary with fallback UI showing "Algo correu mal" + retry button. Styled with new design system.

- [ ] **Step 2: Add to app layout**

Wrap children in ErrorBoundary in the app layout.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add error boundary with fallback UI"
```

---

## Execution Order Summary

```
Phase 1 (Design System)     ──┬── Phase 2 (Navigation) ── Phase 3 (Page Redesign) ── Phase 7 (Onboarding)
                              │                                                        Phase 10 (Cleanup)
                              ├── Phase 4 (Upload) ── Phase 8 (XML Feed)
                              │                    └── Phase 9 (Portal) ← Phase 6
                              └── Phase 5 (Landing) ── Phase 6 (Billing)
```

Start with Phase 1, then Phases 2-5 can begin. Phase 3 needs Phase 2. Phases 6-10 follow their dependencies.
