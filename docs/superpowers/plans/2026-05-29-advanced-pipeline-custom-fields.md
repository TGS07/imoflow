# Pipeline Avancado + Campos Personalizados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 5-stage pipeline with customizable stages per agency, add custom fields on leads, deal values, expected close dates, and weighted pipeline forecasting.

**Architecture:** New DB tables (`pipeline_stages`, `custom_fields`, `custom_field_values`) with RLS. Migration maps existing enum `stage` to FK `stage_id`. New API endpoints for CRUD on stages and custom fields. KanbanBoard becomes dynamic. New `/settings/pipeline` page for agency admins.

**Tech Stack:** Next.js 16, React 19, Supabase (PostgreSQL + RLS), TypeScript, dnd-kit

---

## File Structure

### New Files
- `supabase/migrations/20260529_pipeline_stages.sql` — New tables, data migration, RLS policies
- `app/api/pipeline-stages/route.ts` — GET/POST pipeline stages
- `app/api/pipeline-stages/[id]/route.ts` — PATCH/DELETE single stage
- `app/api/pipeline-stages/reorder/route.ts` — PATCH reorder stages
- `app/api/custom-fields/route.ts` — GET/POST custom fields
- `app/api/custom-fields/[id]/route.ts` — PATCH/DELETE single custom field
- `app/(app)/settings/pipeline/page.tsx` — Settings page for stages + custom fields

### Modified Files
- `types/index.ts` — Add PipelineStage, CustomField, CustomFieldValue types; update Lead type
- `app/api/leads/route.ts` — Join pipeline_stages + custom_field_values; accept stage_id, deal_value, expected_close_date
- `app/api/leads/[id]/route.ts` — Join pipeline_stages + custom_field_values; handle custom field upsert on PATCH
- `app/api/admin/agencies/route.ts` — Seed default pipeline_stages on agency creation
- `components/pipeline/KanbanBoard.tsx` — Dynamic columns from pipeline_stages, deal values, stale indicator
- `components/leads/NewLeadModal.tsx` — Add deal_value, expected_close_date, custom fields
- `components/layout/Sidebar.tsx` — Add Settings nav item
- `app/(app)/pipeline/page.tsx` — Fetch pipeline_stages, pass to KanbanBoard
- `app/(app)/leads/page.tsx` — Dynamic stage filter from pipeline_stages, show deal_value
- `app/(app)/leads/[id]/page.tsx` — Dynamic stages, deal_value, expected_close_date, custom fields display
- `app/(app)/dashboard/page.tsx` — New KPIs (pipeline value, weighted value, forecast)

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260529_pipeline_stages.sql`

- [ ] **Step 1: Create migration file with new tables**

```sql
-- PIPELINE STAGES
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  color text not null default '#6B7280',
  position int not null default 0,
  probability int not null default 0 check (probability between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);

create index pipeline_stages_agency_idx on pipeline_stages(agency_id, position);

-- CUSTOM FIELDS
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  field_type text not null check (field_type in ('text','number','date','select','multiselect','boolean','currency')),
  options jsonb,
  required boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index custom_fields_agency_idx on custom_fields(agency_id, position);

-- CUSTOM FIELD VALUES
create table public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  field_id uuid not null references public.custom_fields(id) on delete cascade,
  value_text text,
  value_number numeric,
  value_date date,
  value_json jsonb,
  created_at timestamptz not null default now(),
  unique(lead_id, field_id)
);

create index custom_field_values_lead_idx on custom_field_values(lead_id);

-- ADD NEW COLUMNS TO LEADS
alter table public.leads add column stage_id uuid references public.pipeline_stages(id);
alter table public.leads add column deal_value numeric;
alter table public.leads add column expected_close_date date;

-- SEED DEFAULT STAGES FOR EXISTING AGENCIES
do $$
declare
  agency record;
  stage_map jsonb;
begin
  for agency in select id from public.agencies loop
    -- Insert default stages and collect mapping
    with inserted as (
      insert into public.pipeline_stages (agency_id, name, color, position, probability, is_won, is_lost)
      values
        (agency.id, 'Lead',        '#3B82F6', 0, 10,  false, false),
        (agency.id, 'Visita',      '#F59E0B', 1, 30,  false, false),
        (agency.id, 'Proposta',    '#8B5CF6', 2, 50,  false, false),
        (agency.id, 'Negociação',  '#F97316', 3, 70,  false, false),
        (agency.id, 'Fechado',     '#10B981', 4, 100, true,  false),
        (agency.id, 'Perdido',     '#EF4444', 5, 0,   false, true)
      returning id, name
    )
    select jsonb_object_agg(
      case name
        when 'Lead' then 'lead'
        when 'Visita' then 'visita'
        when 'Proposta' then 'proposta'
        when 'Negociação' then 'negociacao'
        when 'Fechado' then 'fechado'
      end,
      id
    ) into stage_map
    from inserted
    where name != 'Perdido';

    -- Map existing leads to stage_id
    update public.leads
    set stage_id = (stage_map ->> stage)::uuid
    where agency_id = agency.id and stage is not null;
  end loop;
end $$;

-- Make stage_id NOT NULL now that all leads are mapped
alter table public.leads alter column stage_id set not null;

-- Drop old stage column
alter table public.leads drop column stage;

-- RLS for pipeline_stages
alter table public.pipeline_stages enable row level security;
create policy "pipeline_stages: own agency" on public.pipeline_stages
  for all using (agency_id = public.get_my_agency_id());

-- RLS for custom_fields
alter table public.custom_fields enable row level security;
create policy "custom_fields: own agency" on public.custom_fields
  for all using (agency_id = public.get_my_agency_id());

-- RLS for custom_field_values
alter table public.custom_field_values enable row level security;
create policy "custom_field_values: own agency" on public.custom_field_values
  for all using (
    lead_id in (select id from public.leads where agency_id = public.get_my_agency_id())
  );
```

- [ ] **Step 2: Apply migration to Supabase**

Run the migration on the Supabase dashboard or via CLI:
```bash
npx supabase db push
```

If using Supabase dashboard: copy the SQL above into the SQL Editor and execute.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260529_pipeline_stages.sql
git commit -m "feat: add pipeline_stages, custom_fields tables and migrate stage enum to FK"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Replace entire types/index.ts with updated types**

Replace the full content of `types/index.ts`:

```typescript
export type Agency = {
  id: string
  name: string
  email: string
  logo_url: string | null
  plan: 'free' | 'pro'
  created_at: string
}

export type User = {
  id: string
  agency_id: string
  name: string
  email: string
  role: 'admin' | 'agent'
  avatar_initials: string
}

export type PipelineStage = {
  id: string
  agency_id: string
  name: string
  color: string
  position: number
  probability: number
  is_won: boolean
  is_lost: boolean
  created_at: string
}

export type CustomField = {
  id: string
  agency_id: string
  name: string
  field_type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'currency'
  options: string[] | null
  required: boolean
  position: number
  created_at: string
}

export type CustomFieldValue = {
  id: string
  lead_id: string
  field_id: string
  value_text: string | null
  value_number: number | null
  value_date: string | null
  value_json: unknown | null
  created_at: string
}

export type LeadSource = 'site' | 'instagram' | 'facebook' | 'referencia' | 'outro'

export type Lead = {
  id: string
  agency_id: string
  assigned_to: string | null
  name: string
  email: string | null
  phone: string | null
  stage_id: string
  score: number
  source: LeadSource
  budget: number | null
  zone: string | null
  typology: string | null
  notes: string | null
  deal_value: number | null
  expected_close_date: string | null
  created_at: string
  users?: User
  pipeline_stages?: PipelineStage
  custom_field_values?: CustomFieldValue[]
}

export type Contact = {
  id: string
  lead_id: string
  user_id: string | null
  type: 'chamada' | 'visita' | 'email' | 'nota'
  title: string
  description: string | null
  note: string | null
  created_at: string
  users?: User
}

export type Task = {
  id: string
  lead_id: string
  assigned_to: string | null
  title: string
  due_date: string | null
  completed: boolean
  created_at: string
}

export type EmailSent = {
  id: string
  lead_id: string
  sent_by: string | null
  subject: string
  body: string
  status: 'sent' | 'failed'
  sent_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add PipelineStage, CustomField, CustomFieldValue types; update Lead to use stage_id"
```

---

## Task 3: Pipeline Stages API

**Files:**
- Create: `app/api/pipeline-stages/route.ts`
- Create: `app/api/pipeline-stages/[id]/route.ts`
- Create: `app/api/pipeline-stages/reorder/route.ts`

- [ ] **Step 1: Create GET/POST for pipeline stages**

Create `app/api/pipeline-stages/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .order('position', { ascending: true })

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

  // Get max position
  const { data: maxStage } = await supabase
    .from('pipeline_stages')
    .select('position')
    .eq('agency_id', profile.agency_id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (maxStage?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      agency_id: profile.agency_id,
      name: body.name,
      color: body.color ?? '#6B7280',
      position: nextPosition,
      probability: body.probability ?? 0,
      is_won: body.is_won ?? false,
      is_lost: body.is_lost ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create PATCH/DELETE for single stage**

Create `app/api/pipeline-stages/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get first stage of agency as fallback
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('agency_id')
    .eq('id', id)
    .single()

  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('agency_id', stage.agency_id)
    .neq('id', id)
    .order('position', { ascending: true })
    .limit(1)
    .single()

  if (!firstStage) {
    return NextResponse.json({ error: 'Cannot delete the last stage' }, { status: 400 })
  }

  // Move leads in this stage to the first remaining stage
  await supabase
    .from('leads')
    .update({ stage_id: firstStage.id })
    .eq('stage_id', id)

  const { error } = await supabase.from('pipeline_stages').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create reorder endpoint**

Create `app/api/pipeline-stages/reorder/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stages } = await request.json() as { stages: { id: string; position: number }[] }

  for (const stage of stages) {
    await supabase
      .from('pipeline_stages')
      .update({ position: stage.position })
      .eq('id', stage.id)
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/pipeline-stages/
git commit -m "feat: add pipeline stages CRUD API endpoints"
```

---

## Task 4: Custom Fields API

**Files:**
- Create: `app/api/custom-fields/route.ts`
- Create: `app/api/custom-fields/[id]/route.ts`

- [ ] **Step 1: Create GET/POST for custom fields**

Create `app/api/custom-fields/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('custom_fields')
    .select('*')
    .order('position', { ascending: true })

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

  // Get max position
  const { data: maxField } = await supabase
    .from('custom_fields')
    .select('position')
    .eq('agency_id', profile.agency_id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (maxField?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('custom_fields')
    .insert({
      agency_id: profile.agency_id,
      name: body.name,
      field_type: body.field_type,
      options: body.options ?? null,
      required: body.required ?? false,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create PATCH/DELETE for single custom field**

Create `app/api/custom-fields/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('custom_fields')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('custom_fields').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/custom-fields/
git commit -m "feat: add custom fields CRUD API endpoints"
```

---

## Task 5: Update Leads API to Use stage_id and Custom Fields

**Files:**
- Modify: `app/api/leads/route.ts`
- Modify: `app/api/leads/[id]/route.ts`

- [ ] **Step 1: Update GET/POST leads API**

Replace `app/api/leads/route.ts` entirely:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const stageId = searchParams.get('stage_id')
  const search = searchParams.get('search')

  let query = supabase
    .from('leads')
    .select('*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost)')
    .order('created_at', { ascending: false })

  if (stageId) query = query.eq('stage_id', stageId)
  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()
  const { custom_fields: customFieldValues, ...leadData } = body

  // If no stage_id provided, use the first stage of the agency
  if (!leadData.stage_id) {
    const { data: firstStage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('agency_id', profile.agency_id)
      .order('position', { ascending: true })
      .limit(1)
      .single()

    if (firstStage) leadData.stage_id = firstStage.id
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({ ...leadData, agency_id: profile.agency_id, assigned_to: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Save custom field values if provided
  if (customFieldValues && typeof customFieldValues === 'object') {
    const rows = Object.entries(customFieldValues)
      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
      .map(([fieldId, value]) => {
        const row: Record<string, unknown> = { lead_id: data.id, field_id: fieldId }
        if (typeof value === 'number') row.value_number = value
        else if (Array.isArray(value)) row.value_json = value
        else if (typeof value === 'string') row.value_text = value
        return row
      })

    if (rows.length > 0) {
      await supabase.from('custom_field_values').insert(rows)
    }
  }

  // Notificar o agente atribuido
  await createNotification({
    userId: user.id,
    agencyId: profile.agency_id,
    type: 'new_lead',
    title: `Nova lead: ${data.name}`,
    body: `Foi-te atribuida uma nova lead.${data.phone ? ` Telefone: ${data.phone}` : ''}`,
    link: `/leads/${data.id}`,
  })

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Update GET/PATCH/DELETE lead API**

Replace `app/api/leads/[id]/route.ts` entirely:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('leads')
    .select('*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), custom_field_values(id, field_id, value_text, value_number, value_date, value_json)')
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { custom_fields: customFieldValues, ...leadData } = body

  // Fetch previous state for stage change detection
  const { data: before } = await supabase
    .from('leads')
    .select('stage_id, name, assigned_to, agency_id, pipeline_stages(name)')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('leads')
    .update(leadData)
    .eq('id', id)
    .select('*, pipeline_stages(id, name, color, position, probability, is_won, is_lost)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Upsert custom field values if provided
  if (customFieldValues && typeof customFieldValues === 'object') {
    for (const [fieldId, value] of Object.entries(customFieldValues)) {
      if (value === null || value === '' || value === undefined) {
        await supabase.from('custom_field_values').delete().eq('lead_id', id).eq('field_id', fieldId)
      } else {
        const row: Record<string, unknown> = { lead_id: id, field_id: fieldId, value_text: null, value_number: null, value_date: null, value_json: null }
        if (typeof value === 'number') row.value_number = value
        else if (Array.isArray(value)) row.value_json = value
        else if (typeof value === 'string') row.value_text = value
        await supabase.from('custom_field_values').upsert(row, { onConflict: 'lead_id,field_id' })
      }
    }
  }

  // Notify if stage changed
  if (before && leadData.stage_id && leadData.stage_id !== before.stage_id && before.assigned_to && before.agency_id) {
    const newStageName = data.pipeline_stages?.name ?? 'desconhecida'
    const oldStageName = (before.pipeline_stages as unknown as { name: string } | null)?.name ?? 'desconhecida'
    await createNotification({
      userId: before.assigned_to,
      agencyId: before.agency_id,
      type: 'lead_stage_changed',
      title: `Lead ${before.name} movida para ${newStageName}`,
      body: `A lead ${before.name} foi movida de "${oldStageName}" para "${newStageName}".`,
      link: `/leads/${id}`,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/leads/route.ts app/api/leads/\[id\]/route.ts
git commit -m "feat: update leads API to use stage_id, deal_value, custom fields"
```

---

## Task 6: Seed Default Stages on Agency Creation

**Files:**
- Modify: `app/api/admin/agencies/route.ts`

- [ ] **Step 1: Add stage seeding after agency creation**

After line 53 in `app/api/admin/agencies/route.ts` (right after the agency is created, before creating the auth user), add the stage seeding. Replace the entire POST handler:

Replace the POST function (lines 25-86) in `app/api/admin/agencies/route.ts`:

```typescript
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let name: string, email: string, password: string
  try {
    const body = await request.json()
    name = body.name
    email = body.email
    password = body.password
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email e password sao obrigatorios' }, { status: 400 })
  }

  const admin = getAdminClient()

  // 1. Criar agencia
  const { data: agency, error: agencyError } = await admin
    .from('agencies')
    .insert({ name, email })
    .select()
    .single()

  if (agencyError) return NextResponse.json({ error: agencyError.message }, { status: 500 })

  // 2. Seed default pipeline stages
  await admin.from('pipeline_stages').insert([
    { agency_id: agency.id, name: 'Lead',        color: '#3B82F6', position: 0, probability: 10,  is_won: false, is_lost: false },
    { agency_id: agency.id, name: 'Visita',      color: '#F59E0B', position: 1, probability: 30,  is_won: false, is_lost: false },
    { agency_id: agency.id, name: 'Proposta',    color: '#8B5CF6', position: 2, probability: 50,  is_won: false, is_lost: false },
    { agency_id: agency.id, name: 'Negociacao',  color: '#F97316', position: 3, probability: 70,  is_won: false, is_lost: false },
    { agency_id: agency.id, name: 'Fechado',     color: '#10B981', position: 4, probability: 100, is_won: true,  is_lost: false },
    { agency_id: agency.id, name: 'Perdido',     color: '#EF4444', position: 5, probability: 0,   is_won: false, is_lost: true  },
  ])

  // 3. Criar utilizador no Auth
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    await admin.from('pipeline_stages').delete().eq('agency_id', agency.id)
    await admin.from('agencies').delete().eq('id', agency.id)
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // 4. Criar perfil do utilizador
  const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
  const { error: profileError } = await admin.from('users').insert({
    id: authUser.user.id,
    agency_id: agency.id,
    name,
    email,
    role: 'admin',
    avatar_initials: initials,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    await admin.from('pipeline_stages').delete().eq('agency_id', agency.id)
    await admin.from('agencies').delete().eq('id', agency.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ agency, user: authUser.user }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/agencies/route.ts
git commit -m "feat: seed default pipeline stages when creating agency"
```

---

## Task 7: Update KanbanBoard to Dynamic Stages

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`
- Modify: `app/(app)/pipeline/page.tsx`

- [ ] **Step 1: Rewrite KanbanBoard with dynamic stages**

Replace `components/pipeline/KanbanBoard.tsx` entirely:

```typescript
'use client'
import { useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead, PipelineStage } from '@/types'
import { useRouter } from 'next/navigation'

function LeadCard({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const initials = lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={() => router.push(`/leads/${lead.id}`)}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: 'grab', marginBottom: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
        </div>
        {(lead.typology || lead.zone) && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            {[lead.typology, lead.zone].filter(Boolean).join(' · ')}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {lead.deal_value ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {(lead.deal_value / 1000).toFixed(0)}K€
            </div>
          ) : lead.budget ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {(lead.budget / 1000).toFixed(0)}K€
            </div>
          ) : (
            <div />
          )}
          {lead.expected_close_date && (
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {new Date(lead.expected_close_date).toLocaleDateString('pt-PT')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} style={{ minHeight: 120 }}>{children}</div>
}

type Props = {
  initialLeads: Lead[]
  stages: PipelineStage[]
}

export function KanbanBoard({ initialLeads, stages }: Props) {
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Only show non-lost stages as columns
  const visibleStages = stages.filter(s => !s.is_lost)

  function getStageLeads(stageId: string) {
    return leads.filter(l => l.stage_id === stageId)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const draggedLead = leads.find(l => l.id === active.id)
    if (!draggedLead) return

    // Determine target stage: over could be a column or another card
    const targetStageId = stages.find(s => s.id === over.id)?.id
      ?? leads.find(l => l.id === over.id)?.stage_id

    if (!targetStageId || targetStageId === draggedLead.stage_id) return

    const previous = [...leads]
    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, stage_id: targetStageId } : l))
    const res = await fetch(`/api/leads/${draggedLead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: targetStageId }),
    })
    if (!res.ok) setLeads(previous)
  }

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  // Calculate column totals
  function getColumnTotal(stageId: string): number {
    return getStageLeads(stageId).reduce((sum, l) => sum + (l.deal_value ?? l.budget ?? 0), 0)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0', minHeight: 'calc(100vh - 140px)' }}>
        {visibleStages.map(stage => {
          const stageLeads = getStageLeads(stage.id)
          const columnTotal = getColumnTotal(stage.id)
          return (
            <div key={stage.id} id={stage.id} style={{ minWidth: 240, width: 240, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{stage.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', background: 'var(--border)', padding: '1px 7px', borderRadius: 10 }}>{stageLeads.length}</span>
              </div>
              {columnTotal > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, paddingLeft: 16 }}>
                  {(columnTotal / 1000).toFixed(0)}K€
                  {stage.probability < 100 && (
                    <span style={{ opacity: 0.6 }}> · {((columnTotal * stage.probability / 100) / 1000).toFixed(0)}K€ pond.</span>
                  )}
                </div>
              )}
              <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <DroppableColumn id={stage.id}>
                  {stageLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} isDragging={lead.id === activeId} />
                  ))}
                </DroppableColumn>
              </SortableContext>
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} />}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 2: Update pipeline page to fetch stages**

Replace `app/(app)/pipeline/page.tsx` entirely:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { Lead, PipelineStage } from '@/types'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: leads }, { data: stages }] = await Promise.all([
    supabase.from('leads').select('*, pipeline_stages(id, name, color, position, probability, is_won, is_lost)').order('created_at', { ascending: false }),
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

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/KanbanBoard.tsx app/\(app\)/pipeline/page.tsx
git commit -m "feat: kanban board with dynamic pipeline stages and deal values"
```

---

## Task 8: Update Leads List Page

**Files:**
- Modify: `app/(app)/leads/page.tsx`

- [ ] **Step 1: Rewrite leads page with dynamic stages**

Replace `app/(app)/leads/page.tsx` entirely:

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Lead, PipelineStage } from '@/types'
import { NewLeadModal } from '@/components/leads/NewLeadModal'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetch('/api/pipeline-stages').then(r => r.json()).then(setStages)
  }, [])

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (stageFilter) params.set('stage_id', stageFilter)
    try {
      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar leads')
      const data: Lead[] = await res.json()
      setLeads(data)
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, stageFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  function getStageInfo(lead: Lead) {
    const stage = lead.pipeline_stages ?? stages.find(s => s.id === lead.stage_id)
    return stage ?? { name: '—', color: '#666' }
  }

  return (
    <>
      {showModal && <NewLeadModal onClose={() => setShowModal(false)} onCreated={fetchLeads} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Leads</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{leads.length} leads</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>
          + Novo Lead
        </button>
      </div>

      <div style={{ padding: '20px 32px', display: 'flex', gap: 10 }}>
        <input
          placeholder="Pesquisar por nome, email ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }}
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }}
        >
          <option value="">Todas as fases</option>
          {stages.filter(s => !s.is_lost).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nome', 'Contacto', 'Interesse', 'Valor', 'Origem', 'Score', 'Fase'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>A carregar...</td></tr>
              )}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Nenhum lead encontrado.</td></tr>
              )}
              {leads.map(lead => {
                const stageInfo = getStageInfo(lead)
                return (
                  <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lead.name}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{lead.phone ?? lead.email ?? '—'}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{[lead.typology, lead.zone].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {lead.deal_value ? `${(lead.deal_value / 1000).toFixed(0)}K€` : lead.budget ? `${(lead.budget / 1000).toFixed(0)}K€` : '—'}
                    </td>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>{lead.source}</span>
                    </td>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                      <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: lead.score > 70 ? 'var(--green)' : lead.score > 40 ? 'var(--gold)' : 'var(--red)', width: `${lead.score}%` }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${stageInfo.color}22`, color: stageInfo.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {stageInfo.name}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/leads/page.tsx
git commit -m "feat: leads list page with dynamic stages and deal value column"
```

---

## Task 9: Update Lead Detail Page

**Files:**
- Modify: `app/(app)/leads/[id]/page.tsx`

- [ ] **Step 1: Rewrite lead detail page with dynamic stages and deal fields**

Replace `app/(app)/leads/[id]/page.tsx` entirely:

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lead, Contact, Task, PipelineStage } from '@/types'
import { SendEmailModal } from '@/components/leads/SendEmailModal'

export default function LeadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [showEmail, setShowEmail] = useState(false)
  const [newContactTitle, setNewContactTitle] = useState('')
  const [newContactType, setNewContactType] = useState<Contact['type']>('nota')
  const [newContactDesc, setNewContactDesc] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')

  const fetchAll = useCallback(async () => {
    const [l, c, t, s] = await Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/contacts?lead_id=${id}`).then(r => r.json()),
      fetch(`/api/tasks?lead_id=${id}`).then(r => r.json()),
      fetch('/api/pipeline-stages').then(r => r.json()),
    ])
    setLead(l)
    setContacts(c)
    setTasks(t)
    setStages(s)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function updateStage(stageId: string) {
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: stageId }) })
    setLead(prev => prev ? { ...prev, stage_id: stageId } : prev)
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: id, type: newContactType, title: newContactTitle, description: newContactDesc }) })
    setNewContactTitle(''); setNewContactDesc('')
    fetchAll()
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: id, title: newTaskTitle, due_date: newTaskDue || null }) })
    setNewTaskTitle(''); setNewTaskDue('')
    fetchAll()
  }

  async function toggleTask(taskId: string, completed: boolean) {
    await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !completed }) })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !completed } : t))
  }

  async function archiveLead() {
    if (!confirm('Arquivar este lead?')) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    router.push('/leads')
  }

  if (!lead) return <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar...</div>

  const currentStage = lead.pipeline_stages ?? stages.find(s => s.id === lead.stage_id)
  const stageColor = currentStage?.color ?? '#666'
  const stageName = currentStage?.name ?? '—'
  const visibleStages = stages.filter(s => !s.is_lost)
  const initials = lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

  return (
    <>
      {showEmail && <SendEmailModal leadId={id} leadEmail={lead.email} onClose={() => setShowEmail(false)} onSent={fetchAll} />}

      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          <Link href="/leads" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Leads</Link>
          <span style={{ color: 'var(--border)' }}>›</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{lead.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowEmail(true)} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>✉ Enviar Email</button>
          <button onClick={archiveLead} style={{ ...inputStyle, background: 'rgba(224,92,92,0.1)', color: 'var(--red)', borderColor: 'rgba(224,92,92,0.25)', cursor: 'pointer' }}>✕ Arquivar</button>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* HERO */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 20, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 20, alignItems: 'start' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${stageColor}, ${stageColor}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#fff' }}>
            {initials}
          </div>
          <div>
            <h2 className="font-display" style={{ fontSize: 22, marginBottom: 8 }}>{lead.name}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: `${stageColor}22`, color: stageColor }}>
                {stageName}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
                {lead.source}
              </span>
              {lead.deal_value && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                  {(lead.deal_value / 1000).toFixed(0)}K€
                </span>
              )}
              {lead.expected_close_date && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
                  Fecho: {new Date(lead.expected_close_date).toLocaleDateString('pt-PT')}
                </span>
              )}
            </div>
            {/* STAGE SELECTOR */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {visibleStages.map(s => (
                <button key={s.id} onClick={() => updateStage(s.id)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: `1px solid ${lead.stage_id === s.id ? s.color : 'var(--border)'}`, background: lead.stage_id === s.id ? `${s.color}22` : 'transparent', color: lead.stage_id === s.id ? s.color : 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif', fontWeight: 600 }}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Score</div>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--gold)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>
              <div className="font-display" style={{ fontSize: 20, color: 'var(--gold)', lineHeight: 1 }}>{lead.score}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)' }}>/100</div>
            </div>
          </div>
        </div>

        {/* CONTACT PILLS */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { icon: '📞', label: 'Telefone', value: lead.phone },
            { icon: '✉', label: 'Email', value: lead.email },
            { icon: '📍', label: 'Zona', value: lead.zone },
            { icon: '🏠', label: 'Tipologia', value: lead.typology },
            { icon: '€', label: 'Orcamento', value: lead.budget ? `${(lead.budget/1000).toFixed(0)}K€` : null },
          ].filter(p => p.value).map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.label}</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{p.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          {/* LEFT — HISTORY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="font-display" style={{ fontSize: 14 }}>Historico de Contactos</div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <form onSubmit={addContact} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select value={newContactType} onChange={e => setNewContactType(e.target.value as Contact['type'])} style={{ ...inputStyle, width: 'auto' }}>
                      <option value="nota">Nota</option>
                      <option value="chamada">Chamada</option>
                      <option value="visita">Visita</option>
                      <option value="email">Email</option>
                    </select>
                    <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Titulo do contacto..." value={newContactTitle} onChange={e => setNewContactTitle(e.target.value)} required />
                    <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Registar</button>
                  </div>
                  <textarea
                    style={{ ...inputStyle, width: '100%', resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
                    placeholder="Descricao (opcional)..."
                    value={newContactDesc}
                    onChange={e => setNewContactDesc(e.target.value)}
                  />
                </form>
                <div>
                  {contacts.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', gap: 12, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold)', marginTop: 3, flexShrink: 0 }} />
                        {i < contacts.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{c.title}</div>
                        {c.description && <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{c.description}</div>}
                        <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7, marginTop: 4 }}>{new Date(c.created_at).toLocaleString('pt-PT')} · {(c.users as unknown as { name: string } | null)?.name ?? ''}</div>
                      </div>
                    </div>
                  ))}
                  {contacts.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem historico ainda.</p>}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — TASKS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div className="font-display" style={{ fontSize: 14 }}>Tarefas</div>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <form onSubmit={addTask} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  <input style={inputStyle} placeholder="Nova tarefa..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} required />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" style={{ ...inputStyle, flex: 1 }} value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} />
                    <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Criar</button>
                  </div>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasks.map(t => (
                    <div key={t.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, opacity: t.completed ? 0.5 : 1 }}>
                      <div onClick={() => toggleTask(t.id, t.completed)} style={{ width: 16, height: 16, borderRadius: 4, border: t.completed ? 'none' : '1.5px solid var(--border)', background: t.completed ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 1, color: '#0D0D0F', fontSize: 10 }}>
                        {t.completed ? '✓' : ''}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: t.completed ? 'var(--muted)' : 'var(--text)', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</div>
                        {t.due_date && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{new Date(t.due_date).toLocaleDateString('pt-PT')}</div>}
                      </div>
                    </div>
                  ))}
                  {tasks.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem tarefas.</p>}
                </div>
              </div>
            </div>

            {lead.notes && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                <div className="font-display" style={{ fontSize: 14, marginBottom: 10 }}>Notas</div>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{lead.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/leads/\[id\]/page.tsx
git commit -m "feat: lead detail page with dynamic stages, deal value, expected close date"
```

---

## Task 10: Update Dashboard with Pipeline Value KPIs

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Rewrite dashboard with new KPIs**

Replace `app/(app)/dashboard/page.tsx` entirely:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: leads }, { data: recentContacts }, { data: stages }] = await Promise.all([
    supabase.from('users').select('name').eq('id', user.id).single(),
    supabase.from('leads').select('id, name, stage_id, typology, zone, budget, deal_value, expected_close_date, created_at, pipeline_stages(id, name, color, probability, is_won, is_lost)').order('created_at', { ascending: false }),
    supabase.from('contacts').select('id, title, created_at, leads(name), users(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
  ])

  const allLeads = leads ?? []
  const allStages = stages ?? []
  const activeLeads = allLeads.filter(l => {
    const s = l.pipeline_stages as unknown as { is_won: boolean; is_lost: boolean } | null
    return s && !s.is_won && !s.is_lost
  }).length

  const wonLeads = allLeads.filter(l => {
    const s = l.pipeline_stages as unknown as { is_won: boolean } | null
    return s?.is_won
  })
  const closedThisMonth = wonLeads.filter(l => {
    const d = new Date(l.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  // Pipeline value calculations
  const pipelineTotal = allLeads
    .filter(l => {
      const s = l.pipeline_stages as unknown as { is_won: boolean; is_lost: boolean } | null
      return s && !s.is_won && !s.is_lost
    })
    .reduce((sum, l) => sum + (l.deal_value ?? l.budget ?? 0), 0)

  const pipelineWeighted = allLeads
    .filter(l => {
      const s = l.pipeline_stages as unknown as { is_won: boolean; is_lost: boolean; probability: number } | null
      return s && !s.is_won && !s.is_lost
    })
    .reduce((sum, l) => {
      const s = l.pipeline_stages as unknown as { probability: number }
      return sum + ((l.deal_value ?? l.budget ?? 0) * s.probability / 100)
    }, 0)

  // Build stage counts using dynamic stages
  const stageCounts: Record<string, number> = {}
  for (const lead of allLeads) {
    stageCounts[lead.stage_id] = (stageCounts[lead.stage_id] ?? 0) + 1
  }
  const total = allLeads.length || 1
  const recentLeads = allLeads.slice(0, 5)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = profile?.name?.split(' ')[0] ?? ''

  function formatValue(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K€`
    return `${v}€`
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 500 }}>{greeting}, {firstName}</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{activeLeads} leads ativos</p>
        </div>
        <Link href="/leads" style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          + Novo Lead
        </Link>
      </div>

      <div style={{ padding: '28px 32px', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard label="Leads Ativos" value={activeLeads} icon="◎" />
          <StatCard label="Pipeline Total" value={formatValue(pipelineTotal)} icon="€" />
          <StatCard label="Pipeline Ponderado" value={formatValue(pipelineWeighted)} icon="◈" />
          <StatCard label="Fechados (mes)" value={closedThisMonth} icon="✓" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Pipeline de Vendas
              <Link href="/pipeline" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'var(--gold)', fontWeight: 500, textDecoration: 'none' }}>Ver tudo →</Link>
            </div>
            <div style={{ display: 'flex', gap: 2, height: 6, borderRadius: 4, overflow: 'hidden', marginBottom: 16, background: 'var(--border)' }}>
              {allLeads.length > 0 && allStages.filter(s => !s.is_lost).map(stage => {
                const count = stageCounts[stage.id] ?? 0
                if (count === 0) return null
                return <div key={stage.id} style={{ background: stage.color, width: `${(count / total) * 100}%` }} />
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              {allStages.filter(s => !s.is_lost).map(stage => {
                const count = stageCounts[stage.id] ?? 0
                return (
                  <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: stage.color }} />
                    {stage.name} ({count})
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentLeads.map(lead => {
                const leadStage = (lead.pipeline_stages as unknown as { name: string; color: string } | null)
                const color = leadStage?.color ?? '#666'
                const label = leadStage?.name ?? '—'
                return (
                  <Link key={lead.id} href={`/leads/${lead.id}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, textDecoration: 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#0D0D0F' }}>
                      {lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>{lead.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{lead.typology ?? ''}{lead.zone ? ` · ${lead.zone}` : ''}</div>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {lead.deal_value ? `${(lead.deal_value / 1000).toFixed(0)}K€` : lead.budget ? `${(lead.budget / 1000).toFixed(0)}K€` : '—'}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${color}22`, color }}>
                      {label}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 14 }}>Atividade Recente</div>
            <div>
              {(recentContacts ?? []).map((c, i) => (
                <div key={c.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < (recentContacts?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                    {i < (recentContacts?.length ?? 0) - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4, minHeight: 20 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text)', lineHeight: 1.5 }}>{c.title} — <strong style={{ color: 'var(--gold)', fontWeight: 500 }}>{(c.leads as unknown as { name: string } | null)?.name}</strong></div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{new Date(c.created_at).toLocaleDateString('pt-PT')}</div>
                  </div>
                </div>
              ))}
              {(recentContacts ?? []).length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem atividade recente.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/dashboard/page.tsx
git commit -m "feat: dashboard with pipeline value KPIs and dynamic stages"
```

---

## Task 11: Update NewLeadModal with Deal Fields

**Files:**
- Modify: `components/leads/NewLeadModal.tsx`

- [ ] **Step 1: Add deal_value and expected_close_date to NewLeadModal**

Replace `components/leads/NewLeadModal.tsx` entirely:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { LeadSource, CustomField } from '@/types'

type Props = {
  onClose: () => void
  onCreated: () => void
}

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'site', label: '🌐 Site' },
  { value: 'instagram', label: '📱 Instagram' },
  { value: 'facebook', label: '📘 Facebook' },
  { value: 'referencia', label: '👤 Referência' },
  { value: 'outro', label: '◯ Outro' },
]

export function NewLeadModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'site' as LeadSource, zone: '', typology: '', budget: '', deal_value: '', expected_close_date: '' })
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }
  const labelStyle = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  useEffect(() => {
    fetch('/api/custom-fields').then(r => r.json()).then(setCustomFields)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      // Build custom field values object
      const cfValues: Record<string, string | number | null> = {}
      for (const field of customFields) {
        const raw = customValues[field.id]
        if (!raw && field.required) return // don't submit if required field is empty
        if (!raw) continue
        if (field.field_type === 'number' || field.field_type === 'currency') {
          cfValues[field.id] = Number(raw)
        } else {
          cfValues[field.id] = raw
        }
      }

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budget: form.budget ? Number(form.budget) : null,
          deal_value: form.deal_value ? Number(form.deal_value) : null,
          expected_close_date: form.expected_close_date || null,
          custom_fields: Object.keys(cfValues).length > 0 ? cfValues : undefined,
        }),
      })
      if (!res.ok) throw new Error('Erro ao criar lead')
      onCreated()
      onClose()
    } catch {
      // keep modal open on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Novo Lead</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={labelStyle}>Nome *</label><input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label style={labelStyle}>Telefone</label><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Zona</label><input style={inputStyle} value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} placeholder="Ex: Cascais" /></div>
            <div><label style={labelStyle}>Tipologia</label><input style={inputStyle} value={form.typology} onChange={e => setForm(p => ({ ...p, typology: e.target.value }))} placeholder="Ex: T3" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Orcamento (€)</label><input type="number" style={inputStyle} value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="Ex: 350000" /></div>
            <div>
              <label style={labelStyle}>Origem</label>
              <select style={{ ...inputStyle }} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value as LeadSource }))}>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Deal fields */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Negocio</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Valor do Negocio (€)</label><input type="number" style={inputStyle} value={form.deal_value} onChange={e => setForm(p => ({ ...p, deal_value: e.target.value }))} placeholder="Ex: 15000" /></div>
              <div><label style={labelStyle}>Data Prevista de Fecho</label><input type="date" style={inputStyle} value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))} /></div>
            </div>
          </div>

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Campos Personalizados</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {customFields.map(field => (
                  <div key={field.id}>
                    <label style={labelStyle}>{field.name}{field.required ? ' *' : ''}</label>
                    {field.field_type === 'select' ? (
                      <select
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                      >
                        <option value="">Selecionar...</option>
                        {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.field_type === 'boolean' ? (
                      <select
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                      >
                        <option value="">—</option>
                        <option value="true">Sim</option>
                        <option value="false">Nao</option>
                      </select>
                    ) : (
                      <input
                        type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 11, fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, color: '#0D0D0F', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Jost, sans-serif' }}>
              {loading ? 'A criar...' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/leads/NewLeadModal.tsx
git commit -m "feat: new lead modal with deal value, close date, and custom fields"
```

---

## Task 12: Add Settings Link to Sidebar

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Settings nav item**

In `components/layout/Sidebar.tsx`, add a new section to the navItems array and a "Configuracao" section in the nav. Replace the `navItems` constant (line 5-9) and add the settings item:

Replace `components/layout/Sidebar.tsx` lines 5-9:

```typescript
const navItems = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard', section: 'Principal' },
  { href: '/leads', icon: '◎', label: 'Leads', section: 'Principal' },
  { href: '/pipeline', icon: '◈', label: 'Pipeline', section: 'Principal' },
  { href: '/settings/pipeline', icon: '⚙', label: 'Configurações', section: 'Sistema' },
]
```

Then in the nav rendering, group by section. Replace lines 26-36:

```typescript
      <nav style={{ padding: '24px 0', flex: 1 }}>
        {['Principal', 'Sistema'].map(section => (
          <div key={section}>
            <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 24px', marginBottom: 6, marginTop: 16 }}>{section}</div>
            {navItems.filter(item => item.section === section).map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', fontSize: 13, color: active ? 'var(--gold)' : 'var(--muted)', background: active ? 'var(--gold-glow)' : 'transparent', borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent', textDecoration: 'none', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: add settings link to sidebar navigation"
```

---

## Task 13: Create Pipeline Settings Page

**Files:**
- Create: `app/(app)/settings/pipeline/page.tsx`

- [ ] **Step 1: Create the settings page with stage and custom field management**

Create `app/(app)/settings/pipeline/page.tsx`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { PipelineStage, CustomField } from '@/types'

const COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#F97316', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E']
const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Numero' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Lista' },
  { value: 'boolean', label: 'Sim/Nao' },
  { value: 'currency', label: 'Moeda' },
]

export default function PipelineSettingsPage() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [newStageName, setNewStageName] = useState('')
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

  useEffect(() => {
    Promise.all([
      fetch('/api/pipeline-stages').then(r => r.json()),
      fetch('/api/custom-fields').then(r => r.json()),
    ]).then(([s, f]) => { setStages(s); setCustomFields(f) })
  }, [])

  async function addStage(e: React.FormEvent) {
    e.preventDefault()
    if (!newStageName.trim()) return
    const res = await fetch('/api/pipeline-stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newStageName, color: COLORS[stages.length % COLORS.length] }),
    })
    if (res.ok) {
      const stage = await res.json()
      setStages(prev => [...prev, stage])
      setNewStageName('')
    }
  }

  async function updateStage(id: string, updates: Partial<PipelineStage>) {
    setSaving(id)
    await fetch(`/api/pipeline-stages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    setSaving(null)
  }

  async function deleteStage(id: string) {
    if (!confirm('Eliminar esta etapa? Os leads serao movidos para a primeira etapa.')) return
    await fetch(`/api/pipeline-stages/${id}`, { method: 'DELETE' })
    setStages(prev => prev.filter(s => s.id !== id))
  }

  async function moveStage(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= stages.length) return
    const reordered = [...stages]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)
    const withPositions = reordered.map((s, i) => ({ ...s, position: i }))
    setStages(withPositions)
    await fetch('/api/pipeline-stages/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stages: withPositions.map(s => ({ id: s.id, position: s.position })) }),
    })
  }

  async function addField(e: React.FormEvent) {
    e.preventDefault()
    if (!newFieldName.trim()) return
    const body: Record<string, unknown> = { name: newFieldName, field_type: newFieldType }
    if ((newFieldType === 'select' || newFieldType === 'multiselect') && newFieldOptions.trim()) {
      body.options = newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
    }
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const field = await res.json()
      setCustomFields(prev => [...prev, field])
      setNewFieldName('')
      setNewFieldOptions('')
    }
  }

  async function deleteField(id: string) {
    if (!confirm('Eliminar este campo? Todos os valores serao perdidos.')) return
    await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
    setCustomFields(prev => prev.filter(f => f.id !== id))
  }

  return (
    <>
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 className="font-display" style={{ fontSize: 20 }}>Configuracoes do Pipeline</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Personaliza as etapas e campos do teu CRM</p>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 720 }}>
        {/* STAGES */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 16, marginBottom: 16 }}>Etapas do Pipeline</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {stages.map((stage, i) => (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moveStage(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: i === 0 ? 'default' : 'pointer', fontSize: 10, opacity: i === 0 ? 0.3 : 1, padding: 0 }}>▲</button>
                  <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: i === stages.length - 1 ? 'default' : 'pointer', fontSize: 10, opacity: i === stages.length - 1 ? 0.3 : 1, padding: 0 }}>▼</button>
                </div>
                <input
                  type="color"
                  value={stage.color}
                  onChange={e => updateStage(stage.id, { color: e.target.value })}
                  style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={stage.name}
                  onChange={e => updateStage(stage.id, { name: e.target.value })}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', minWidth: 80 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={stage.probability}
                    onChange={e => updateStage(stage.id, { probability: Number(e.target.value) })}
                    style={{ ...inputStyle, width: 50, textAlign: 'center' as const }}
                  />
                  <span>%</span>
                </div>
                <div style={{ display: 'flex', gap: 4, fontSize: 9 }}>
                  {stage.is_won && <span style={{ padding: '2px 6px', borderRadius: 3, background: '#10B98122', color: '#10B981', fontWeight: 600 }}>WON</span>}
                  {stage.is_lost && <span style={{ padding: '2px 6px', borderRadius: 3, background: '#EF444422', color: '#EF4444', fontWeight: 600 }}>LOST</span>}
                </div>
                <button
                  onClick={() => deleteStage(stage.id)}
                  disabled={stages.length <= 1 || saving === stage.id}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: stages.length <= 1 ? 'default' : 'pointer', fontSize: 14, opacity: stages.length <= 1 ? 0.3 : 1, padding: '0 4px' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={addStage} style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Nova etapa..." value={newStageName} onChange={e => setNewStageName(e.target.value)} />
            <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Adicionar</button>
          </form>
        </div>

        {/* CUSTOM FIELDS */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
          <div className="font-display" style={{ fontSize: 16, marginBottom: 16 }}>Campos Personalizados</div>

          {customFields.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {customFields.map(field => (
                <div key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{field.name}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
                    {FIELD_TYPES.find(t => t.value === field.field_type)?.label ?? field.field_type}
                  </span>
                  {field.required && <span style={{ fontSize: 9, color: 'var(--gold)' }}>Obrigatório</span>}
                  {field.options && (
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{(field.options as string[]).join(', ')}</span>
                  )}
                  <button onClick={() => deleteField(field.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addField} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Nome do campo..." value={newFieldName} onChange={e => setNewFieldName(e.target.value)} />
              <select style={inputStyle} value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Adicionar</button>
            </div>
            {(newFieldType === 'select' || newFieldType === 'multiselect') && (
              <input style={inputStyle} placeholder="Opcoes separadas por virgula (ex: Opcao A, Opcao B)" value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} />
            )}
          </form>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/settings/pipeline/page.tsx
git commit -m "feat: pipeline settings page with stage and custom field management"
```

---

## Task 14: Update Notification Utility for Stage Names

**Files:**
- Modify: `lib/notifications.ts`

- [ ] **Step 1: No changes needed**

The `lib/notifications.ts` file receives `title` and `body` strings from the calling API routes. Since the API routes (Task 5) now pass the stage name instead of the stage enum, the notification utility itself does not need changes. This task is complete — verify by reading the notification calls in the updated API routes.

- [ ] **Step 2: Commit (skip if no changes)**

No changes needed for this file.

---

## Task 15: Verify and Fix Build

- [ ] **Step 1: Run the build**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx next build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Fix any build errors**

If there are build errors referencing old `stage` property or `LeadStage` type:
- Search for remaining references: `grep -r "LeadStage\|\.stage[^_]" --include="*.ts" --include="*.tsx" app/ components/ lib/`
- Fix each reference to use `stage_id` and `PipelineStage` instead.

- [ ] **Step 3: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors from stage migration"
```
