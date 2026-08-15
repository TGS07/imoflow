# Idealista Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python idealista-bot with integrated ImoFlow functionality: cron-based Gmail scanning, LLM parsing/matching/drafting, a recommendations carousel page, and WhatsApp sending via wa.me links.

**Architecture:** A Vercel cron route (`/api/cron/idealista`) runs hourly, scanning Gmail for Idealista alerts, parsing them with the Groq LLM (already configured), matching against lead preferences, drafting messages, and saving matches to existing Supabase tables. A new `/recommendations` page displays pending matches in a swipeable carousel with Send (WhatsApp), Edit, and Ignore actions.

**Tech Stack:** Next.js (existing), Groq/LLama via OpenAI-compatible SDK (existing `lib/ai/client.ts`), `googleapis` npm package (new), Supabase (existing tables: `idealista_processed_emails`, `idealista_listings`, `idealista_matches`, `lead_preferences`).

---

## File Structure

**New files:**
- `lib/idealista/gmail.ts` — Gmail OAuth2 client (list alerts, get raw email)
- `lib/idealista/parser.ts` — Extract listings from email HTML using LLM
- `lib/idealista/matching.ts` — Deterministic + fuzzy zone matching
- `lib/idealista/drafter.ts` — LLM-powered message drafting
- `lib/idealista/types.ts` — TypeScript types for Listing, MatchReason, LeadPreference
- `app/api/cron/idealista/route.ts` — Cron endpoint orchestrating the full flow
- `app/api/recommendations/[id]/route.ts` — PATCH to update match status/message
- `app/(app)/recommendations/page.tsx` — Carousel UI page

**Modified files:**
- `components/layout/Sidebar.tsx` — Add "Recomendações" nav item with badge
- `components/ui/Icon.tsx` — Add `'sparkle'` icon for recommendations
- `vercel.json` — Add cron schedule entry
- `package.json` — Add `googleapis` dependency

---

### Task 1: Install googleapis and add types

**Files:**
- Create: `lib/idealista/types.ts`
- Modify: `package.json`

- [ ] **Step 1: Install googleapis**

```bash
npm install googleapis
```

- [ ] **Step 2: Create types file**

Create `lib/idealista/types.ts`:

```typescript
export interface Listing {
  titulo: string | null
  zona: string | null
  tipologia: string | null
  preco: number | null
  m2: number | null
  extras: string[]
  link: string | null
}

export interface ParsedEmail {
  listings: Listing[]
}

export interface MatchReason {
  zona_ok: boolean
  tipologia_ok: boolean
  preco_ok: boolean
  extras_ok: boolean
  explicacao: string
}

export interface LeadPreference {
  id: string
  lead_id: string
  lead_name: string
  lead_email: string | null
  lead_phone: string | null
  zonas: string[]
  tipologia_min: string | null
  preco_max: number | null
  extras: string[]
  agency_id: string
  agent_user_id: string | null
  agent_name: string | null
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/idealista/types.ts package.json package-lock.json
git commit -m "feat(idealista): add types and googleapis dependency"
```

---

### Task 2: Gmail client

**Files:**
- Create: `lib/idealista/gmail.ts`

- [ ] **Step 1: Create Gmail client**

Create `lib/idealista/gmail.ts`:

```typescript
import { google } from 'googleapis'

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return client
}

export function isGmailConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  )
}

export async function listAlertMessageIds(
  query = 'from:naoresponder@idealista.pt',
  maxResults = 25
): Promise<string[]> {
  const auth = getOAuth2Client()
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  })
  return (res.data.messages ?? []).map((m) => m.id!)
}

export async function getRawMessage(messageId: string): Promise<string> {
  const auth = getOAuth2Client()
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'raw',
  })
  const raw = res.data.raw!
  return Buffer.from(raw, 'base64url').toString('utf-8')
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/idealista/gmail.ts
git commit -m "feat(idealista): gmail client for reading alert emails"
```

---

### Task 3: Email parser (LLM)

**Files:**
- Create: `lib/idealista/parser.ts`

- [ ] **Step 1: Create parser**

Create `lib/idealista/parser.ts`. This translates the Python parser — strips HTML to text preserving links, sends to LLM for structured extraction.

```typescript
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import type { Listing, ParsedEmail } from './types'

const SYSTEM_PROMPT = `És um extrator de dados de emails de alerta do portal imobiliário Idealista.

Recebes o texto de um email (pode vir reencaminhado, com cabeçalhos e rodapés).
A tua tarefa é encontrar TODOS os imóveis anunciados e devolver os dados de cada um.

Devolve EXCLUSIVAMENTE JSON válido, sem texto à volta, com esta forma:
{
  "listings": [
    {
      "titulo": "string ou null",
      "zona": "string ou null (a localização do imóvel: zona/freguesia/rua)",
      "tipologia": "string ou null (ex: T0, T1, T2, T3...)",
      "preco": número inteiro em euros ou null (ex: 370000, não '370.000 €'),
      "m2": número inteiro ou null,
      "extras": ["lista", "de", "caracteristicas"] (ex: garagem, varanda, vista mar, elevador, condomínio; [] se nenhum),
      "link": "url do anúncio (idealista.pt/imovel/...) sem parâmetros utm, ou null"
    }
  ]
}

Regras:
- Se um campo não estiver no email, usa null (ou [] para extras). NUNCA inventes.
- No link, remove tudo a partir de '?' (os parâmetros de tracking utm).
- Ignora banners, rodapés, links de "ver todos os anúncios", apps e descontos.
- Se o email não tiver nenhum imóvel, devolve {"listings": []}.`

function stripHtmlToText(html: string): string {
  let text = html
  // Preserve href links inline before stripping tags
  text = text.replace(/<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 [$1]')
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  return text
}

function extractTextFromRawEmail(raw: string): string {
  // Find HTML part in multipart email (or treat whole thing as HTML)
  const htmlMatch = raw.match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\Z)/i)
  if (htmlMatch) {
    return stripHtmlToText(htmlMatch[1])
  }
  // Fallback: strip tags from entire raw content
  return stripHtmlToText(raw)
}

export async function parseEmail(rawEmail: string): Promise<ParsedEmail> {
  const text = extractTextFromRawEmail(rawEmail)
  const client = getAIClient()

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extrai os imóveis deste email:\n\n${text}` },
    ],
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content ?? '{"listings":[]}'
  let json: string = content.trim()
  if (json.startsWith('```')) {
    json = json.split('```')[1]
    if (json.startsWith('json')) json = json.slice(4)
    json = json.trim()
  }

  const data = JSON.parse(json)
  const listings: Listing[] = (data.listings ?? []).map((item: Record<string, unknown>) => ({
    titulo: (item.titulo as string) ?? null,
    zona: (item.zona as string) ?? null,
    tipologia: (item.tipologia as string) ?? null,
    preco: typeof item.preco === 'number' ? item.preco : null,
    m2: typeof item.m2 === 'number' ? item.m2 : null,
    extras: Array.isArray(item.extras) ? item.extras : [],
    link: item.link ? String(item.link).split('?')[0] : null,
  }))

  return { listings }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/idealista/parser.ts
git commit -m "feat(idealista): email parser using LLM for listing extraction"
```

---

### Task 4: Matching engine

**Files:**
- Create: `lib/idealista/matching.ts`

- [ ] **Step 1: Create matching module**

Create `lib/idealista/matching.ts`. Direct port of the Python logic: deterministic checks first, then LLM for fuzzy zone matching.

```typescript
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import type { Listing, LeadPreference, MatchReason } from './types'

function tipologiaToNum(tipologia: string | null): number | null {
  if (!tipologia) return null
  const m = tipologia.match(/[tT]\s*(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

function precoOk(listing: Listing, pref: LeadPreference): boolean {
  if (pref.preco_max === null) return true
  if (listing.preco === null) return false
  return listing.preco <= pref.preco_max
}

function tipologiaOk(listing: Listing, pref: LeadPreference): boolean {
  if (!pref.tipologia_min) return true
  const minimo = tipologiaToNum(pref.tipologia_min)
  const atual = tipologiaToNum(listing.tipologia)
  if (minimo === null) return true
  if (atual === null) return false
  return atual >= minimo
}

function extrasOk(listing: Listing, pref: LeadPreference): boolean {
  if (!pref.extras.length) return true
  const presentes = new Set(listing.extras.map((e) => e.toLowerCase().trim()))
  return pref.extras.every((req) =>
    Array.from(presentes).some(
      (p) => p.includes(req.toLowerCase().trim()) || req.toLowerCase().trim().includes(p)
    )
  )
}

async function zonaOk(listing: Listing, pref: LeadPreference): Promise<boolean> {
  if (!pref.zonas.length) return true
  if (!listing.zona) return false

  const client = getAIClient()
  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: 'user',
        content: `A localização de um imóvel é: "${listing.zona}".\nO comprador procura nestas zonas: ${JSON.stringify(pref.zonas)}.\n\nA localização do imóvel pertence (ou está contida) em alguma das zonas procuradas pelo comprador? Considera bairros, freguesias e localidades vizinhas dentro do mesmo concelho/zona. Responde APENAS com 'sim' ou 'não'.`,
      },
    ],
    max_tokens: 5,
  })

  const answer = (response.choices[0]?.message?.content ?? '').trim().toLowerCase()
  return answer.startsWith('sim') || answer.startsWith('s')
}

export async function evaluateMatch(
  listing: Listing,
  pref: LeadPreference
): Promise<MatchReason | null> {
  const pOk = precoOk(listing, pref)
  const tOk = tipologiaOk(listing, pref)
  const eOk = extrasOk(listing, pref)

  if (!(pOk && tOk && eOk)) return null

  const zOk = await zonaOk(listing, pref)
  if (!zOk) return null

  const partes: string[] = []
  if (pref.zonas.length) partes.push(`zona (${listing.zona} ⊂ ${pref.zonas.join(', ')})`)
  if (pref.tipologia_min) partes.push(`tipologia (${listing.tipologia} ≥ ${pref.tipologia_min})`)
  if (pref.preco_max !== null) partes.push(`preço (${listing.preco}€ ≤ ${pref.preco_max}€)`)
  if (pref.extras.length) partes.push(`extras (${pref.extras.join(', ')})`)

  return {
    zona_ok: zOk,
    tipologia_ok: tOk,
    preco_ok: pOk,
    extras_ok: eOk,
    explicacao: 'Match em: ' + partes.join('; '),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/idealista/matching.ts
git commit -m "feat(idealista): matching engine with deterministic + LLM zone checks"
```

---

### Task 5: Message drafter

**Files:**
- Create: `lib/idealista/drafter.ts`

- [ ] **Step 1: Create drafter**

Create `lib/idealista/drafter.ts`:

```typescript
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import type { Listing, LeadPreference } from './types'

const SYSTEM_PROMPT = `És um agente imobiliário português a escrever a um cliente comprador por WhatsApp.

Escreves uma mensagem curta, calorosa e natural (NÃO um anúncio, NÃO marketing agressivo), a avisar o cliente de que apareceu um imóvel que encaixa no que ele procura. Tom profissional mas próximo, como quem conhece o cliente.

Regras:
- Português de Portugal.
- 3 a 5 frases no máximo.
- Trata o cliente pelo primeiro nome.
- Refere os pontos concretos que interessam (tipologia, zona, preço, algum extra relevante).
- Inclui o link do anúncio.
- Termina com uma pergunta simples (ex: se quer agendar uma visita).
- Assina apenas com o primeiro nome do agente.
- NÃO inventes características que não estejam nos dados.
- Devolve só o texto da mensagem, sem assunto nem cabeçalhos.`

export async function draftMessage(
  listing: Listing,
  pref: LeadPreference,
  agentName: string
): Promise<string> {
  const client = getAIClient()
  const detalhes = [
    `Cliente: ${pref.lead_name}`,
    `Agente: ${agentName}`,
    `Imóvel: ${listing.titulo}`,
    `Tipologia: ${listing.tipologia}`,
    `Zona: ${listing.zona}`,
    `Preço: ${listing.preco}€`,
    `Área: ${listing.m2} m²`,
    `Extras: ${listing.extras.length ? listing.extras.join(', ') : '—'}`,
    `Link: ${listing.link}`,
  ].join('\n')

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Escreve a mensagem.\n\n${detalhes}` },
    ],
    max_tokens: 400,
  })

  return (response.choices[0]?.message?.content ?? '').trim()
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/idealista/drafter.ts
git commit -m "feat(idealista): LLM-powered message drafter for WhatsApp"
```

---

### Task 6: Cron route

**Files:**
- Create: `app/api/cron/idealista/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create cron route**

Create `app/api/cron/idealista/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications'
import { isGmailConfigured, listAlertMessageIds, getRawMessage } from '@/lib/idealista/gmail'
import { parseEmail } from '@/lib/idealista/parser'
import { evaluateMatch } from '@/lib/idealista/matching'
import { draftMessage } from '@/lib/idealista/drafter'
import type { LeadPreference } from '@/lib/idealista/types'

export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isGmailConfigured()) {
    return NextResponse.json({ error: 'Gmail not configured' }, { status: 500 })
  }

  const supabase = createServiceClient()
  const query = process.env.GMAIL_QUERY ?? 'from:naoresponder@idealista.pt'

  // 1. List alert emails
  const messageIds = await listAlertMessageIds(query)

  // 2. Filter out already-processed
  const { data: processed } = await supabase
    .from('idealista_processed_emails')
    .select('gmail_message_id')
    .in('gmail_message_id', messageIds)

  const processedSet = new Set((processed ?? []).map((r) => r.gmail_message_id))
  const newIds = messageIds.filter((id) => !processedSet.has(id))

  if (newIds.length === 0) {
    return NextResponse.json({ new_emails: 0, matches: 0 })
  }

  // 3. Load active lead preferences
  const { data: prefRows } = await supabase
    .from('lead_preferences')
    .select('*, leads!inner(id, name, email, phone, agency_id, assigned_to)')
    .eq('is_active', true)

  const agentIds = new Set(
    (prefRows ?? [])
      .map((r: Record<string, any>) => r.leads?.assigned_to)
      .filter(Boolean)
  )

  let agentsById: Record<string, { id: string; name: string }> = {}
  if (agentIds.size > 0) {
    const { data: agents } = await supabase
      .from('users')
      .select('id, name')
      .in('id', Array.from(agentIds))
    agentsById = Object.fromEntries((agents ?? []).map((a) => [a.id, a]))
  }

  const preferences: LeadPreference[] = (prefRows ?? []).map((r: Record<string, any>) => {
    const lead = r.leads ?? {}
    const agent = agentsById[lead.assigned_to] ?? null
    return {
      id: r.id,
      lead_id: r.lead_id,
      lead_name: lead.name ?? '?',
      lead_email: lead.email ?? null,
      lead_phone: lead.phone ?? null,
      zonas: r.zonas ?? [],
      tipologia_min: r.tipologia_min ?? null,
      preco_max: r.preco_max ?? null,
      extras: r.extras ?? [],
      agency_id: lead.agency_id,
      agent_user_id: lead.assigned_to ?? null,
      agent_name: agent?.name ?? null,
    }
  })

  let totalMatches = 0

  // 4. Process each new email
  for (const msgId of newIds) {
    try {
      const raw = await getRawMessage(msgId)
      const parsed = await parseEmail(raw)

      // Mark as processed immediately (even if 0 listings)
      await supabase.from('idealista_processed_emails').upsert(
        { gmail_message_id: msgId, listings_count: parsed.listings.length },
        { onConflict: 'gmail_message_id' }
      )

      for (const listing of parsed.listings) {
        if (!listing.link) continue

        // Upsert listing (dedup by link)
        const { data: existing } = await supabase
          .from('idealista_listings')
          .select('id')
          .eq('link', listing.link)
          .limit(1)

        let listingId: string
        if (existing && existing.length > 0) {
          listingId = existing[0].id
        } else {
          const { data: inserted } = await supabase
            .from('idealista_listings')
            .insert({
              gmail_message_id: msgId,
              titulo: listing.titulo,
              zona: listing.zona,
              tipologia: listing.tipologia,
              preco: listing.preco,
              m2: listing.m2,
              extras: listing.extras,
              link: listing.link,
              raw: listing,
            })
            .select('id')
            .single()
          if (!inserted) continue
          listingId = inserted.id
        }

        // Cross with each preference
        for (const pref of preferences) {
          // Skip if match already exists
          const { data: existingMatch } = await supabase
            .from('idealista_matches')
            .select('id')
            .eq('listing_id', listingId)
            .eq('lead_id', pref.lead_id)
            .limit(1)

          if (existingMatch && existingMatch.length > 0) continue

          const matchResult = await evaluateMatch(listing, pref)
          if (!matchResult) continue

          const agentName = pref.agent_name ?? 'Agente'
          const message = await draftMessage(listing, pref, agentName)

          const { data: newMatch } = await supabase
            .from('idealista_matches')
            .insert({
              agency_id: pref.agency_id,
              listing_id: listingId,
              lead_id: pref.lead_id,
              user_id: pref.agent_user_id,
              drafted_message: message,
              status: 'pending',
            })
            .select('id')
            .single()

          if (newMatch && pref.agent_user_id) {
            await createNotification({
              userId: pref.agent_user_id,
              agencyId: pref.agency_id,
              type: 'automation_rule_triggered',
              title: `Nova recomendação para ${pref.lead_name}`,
              body: `${listing.titulo ?? 'Imóvel'} em ${listing.zona ?? 'zona desconhecida'} — ${listing.preco ? listing.preco + '€' : 'preço n/d'}`,
              link: '/recommendations',
            }, supabase)
            totalMatches++
          }
        }
      }
    } catch (err) {
      console.error(`Failed to process email ${msgId}:`, err)
      // Mark as processed to avoid infinite retry
      await supabase.from('idealista_processed_emails').upsert(
        { gmail_message_id: msgId, listings_count: 0 },
        { onConflict: 'gmail_message_id' }
      )
    }
  }

  return NextResponse.json({ new_emails: newIds.length, matches: totalMatches })
}
```

- [ ] **Step 2: Add cron to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/idealista",
  "schedule": "0 * * * *"
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/idealista/route.ts vercel.json
git commit -m "feat(idealista): cron route for hourly Gmail scan and matching"
```

---

### Task 7: Recommendations API route

**Files:**
- Create: `app/api/recommendations/[id]/route.ts`

- [ ] **Step 1: Create API route for match actions**

Create `app/api/recommendations/[id]/route.ts`:

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

  const body = await request.json()
  const { action, drafted_message } = body as {
    action: 'sent' | 'ignored' | 'edited'
    drafted_message?: string
  }

  const service = createServiceClient()

  if (action === 'sent') {
    await service
      .from('idealista_matches')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
  } else if (action === 'ignored') {
    await service
      .from('idealista_matches')
      .update({ status: 'ignored' })
      .eq('id', id)
      .eq('user_id', user.id)
  } else if (action === 'edited' && drafted_message) {
    await service
      .from('idealista_matches')
      .update({ drafted_message, status: 'edited' })
      .eq('id', id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/recommendations/[id]/route.ts
git commit -m "feat(idealista): API route for recommendation actions (send/edit/ignore)"
```

---

### Task 8: Add sparkle icon and sidebar entry

**Files:**
- Modify: `components/ui/Icon.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add sparkle icon**

In `components/ui/Icon.tsx`, add `'sparkle'` to the `IconName` type union and add the path to `PATHS`:

```typescript
// Add to IconName type:
| 'sparkle'

// Add to PATHS:
sparkle: <><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2Z" /></>,
```

- [ ] **Step 2: Add sidebar entry**

In `components/layout/Sidebar.tsx`, add to the `navItems` array after the `properties` entry:

```typescript
{ href: '/recommendations', icon: 'sparkle', label: 'Recomendações', section: 'Principal' },
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/Icon.tsx components/layout/Sidebar.tsx
git commit -m "feat(idealista): add recommendations to sidebar with sparkle icon"
```

---

### Task 9: Recommendations page with carousel

**Files:**
- Create: `app/(app)/recommendations/page.tsx`

- [ ] **Step 1: Create recommendations page**

Create `app/(app)/recommendations/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RecommendationsCarousel } from './RecommendationsCarousel'

export default async function RecommendationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/login')

  const { data: matches } = await supabase
    .from('idealista_matches')
    .select(`
      id, status, drafted_message, created_at,
      idealista_listings(titulo, zona, tipologia, preco, m2, extras, link),
      leads(id, name, phone, email)
    `)
    .eq('user_id', user.id)
    .eq('agency_id', userData.agency_id)
    .in('status', ['pending', 'edited'])
    .order('created_at', { ascending: false })

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
          Recomendações
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Imóveis do Idealista que encaixam nas preferências dos seus leads
        </p>
      </div>
      <RecommendationsCarousel matches={matches ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Create carousel client component**

Create `app/(app)/recommendations/RecommendationsCarousel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

interface Match {
  id: string
  status: string
  drafted_message: string
  created_at: string
  idealista_listings: {
    titulo: string | null
    zona: string | null
    tipologia: string | null
    preco: number | null
    m2: number | null
    extras: string[]
    link: string | null
  } | null
  leads: {
    id: string
    name: string
    phone: string | null
    email: string | null
  } | null
}

export function RecommendationsCarousel({ matches: initial }: { matches: Match[] }) {
  const [matches, setMatches] = useState(initial)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(false)

  if (matches.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
        <Icon name="sparkle" size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
        <p style={{ fontSize: 15 }}>Sem recomendações pendentes</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>Novas recomendações aparecem quando o scan do Idealista encontra imóveis que encaixam nas preferências dos seus leads.</p>
      </div>
    )
  }

  const match = matches[currentIndex]
  if (!match) return null
  const listing = match.idealista_listings
  const lead = match.leads

  async function handleAction(action: 'sent' | 'ignored', message?: string) {
    setLoading(true)
    try {
      await fetch(`/api/recommendations/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (action === 'sent' && lead?.phone && message) {
        const phone = lead.phone.replace(/\D/g, '')
        const encoded = encodeURIComponent(message)
        window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank')
      }

      setMatches((prev) => prev.filter((m) => m.id !== match.id))
      setCurrentIndex((prev) => Math.min(prev, matches.length - 2))
      setEditingId(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEdit() {
    setLoading(true)
    try {
      await fetch(`/api/recommendations/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edited', drafted_message: editText }),
      })
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, drafted_message: editText, status: 'edited' } : m))
      )
      setEditingId(null)
    } finally {
      setLoading(false)
    }
  }

  const message = match.drafted_message

  return (
    <div>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {currentIndex + 1} de {matches.length}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: currentIndex === 0 ? 'default' : 'pointer', opacity: currentIndex === 0 ? 0.4 : 1 }}
          >
            ← Anterior
          </button>
          <button
            onClick={() => setCurrentIndex((i) => Math.min(matches.length - 1, i + 1))}
            disabled={currentIndex === matches.length - 1}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: currentIndex === matches.length - 1 ? 'default' : 'pointer', opacity: currentIndex === matches.length - 1 ? 0.4 : 1 }}
          >
            Seguinte →
          </button>
        </div>
      </div>

      {/* Card */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
        {/* Listing info */}
        <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                {listing?.titulo ?? 'Imóvel sem título'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                {[listing?.zona, listing?.tipologia, listing?.m2 ? `${listing.m2} m²` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
            {listing?.preco && (
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                {listing.preco.toLocaleString('pt-PT')}€
              </div>
            )}
          </div>
          {listing?.extras && listing.extras.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {listing.extras.map((extra, i) => (
                <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  {extra}
                </span>
              ))}
            </div>
          )}
          {listing?.link && (
            <a href={listing.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', marginTop: 12, display: 'inline-block' }}>
              Ver no Idealista ↗
            </a>
          )}
        </div>

        {/* Lead info */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 4 }}>Lead</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{lead?.name ?? '—'}</div>
          {lead?.phone && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{lead.phone}</div>
          )}
        </div>

        {/* Message */}
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 8 }}>Mensagem</div>
          {editingId === match.id ? (
            <div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={6}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer' }}
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
              {message}
            </p>
          )}
        </div>

        {/* Actions */}
        {editingId !== match.id && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => handleAction('sent', message)}
              disabled={loading || !lead?.phone}
              title={!lead?.phone ? 'Lead sem número de telefone' : undefined}
              style={{ flex: 1, minWidth: 120, padding: '10px 16px', borderRadius: 8, background: '#25D366', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: lead?.phone ? 'pointer' : 'not-allowed', opacity: lead?.phone ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Icon name="whatsapp" size={16} />
              Enviar WhatsApp
            </button>
            <button
              onClick={() => { setEditingId(match.id); setEditText(message) }}
              disabled={loading}
              style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="pencil" size={14} />
              Editar
            </button>
            <button
              onClick={() => handleAction('ignored')}
              disabled={loading}
              style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}
            >
              Ignorar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/recommendations/page.tsx" "app/(app)/recommendations/RecommendationsCarousel.tsx"
git commit -m "feat(idealista): recommendations page with carousel UI"
```

---

### Task 10: Sidebar badge for pending count

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add pending count badge**

Modify `components/layout/Sidebar.tsx` to accept and display a `pendingRecommendations` prop. Update the recommendations nav item to show a badge when count > 0.

Change the component signature to accept the prop:

```typescript
type Props = {
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
  isOpen?: boolean
  onClose?: () => void
  pendingRecommendations?: number
}
```

In the nav item rendering, after the label text for the recommendations item, add:

```tsx
{item.href === '/recommendations' && pendingRecommendations > 0 && (
  <span style={{
    marginLeft: 'auto',
    fontSize: 10,
    fontWeight: 600,
    background: 'linear-gradient(135deg, #C9A84C, #8B6F30)',
    color: '#fff',
    borderRadius: 10,
    padding: '1px 7px',
    minWidth: 18,
    textAlign: 'center',
  }}>
    {pendingRecommendations}
  </span>
)}
```

- [ ] **Step 2: Pass count from AppShell**

In `components/layout/AppShell.tsx`, fetch the pending count and pass it to `Sidebar`. Add a server-side data fetch or client-side fetch for the count. The simplest approach is to add a `pendingRecommendations` prop that the layout passes down.

In `app/(app)/layout.tsx`, query the count:

```typescript
const { count } = await supabase
  .from('idealista_matches')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .in('status', ['pending', 'edited'])
```

Pass `pendingRecommendations={count ?? 0}` through to the Sidebar.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx components/layout/AppShell.tsx "app/(app)/layout.tsx"
git commit -m "feat(idealista): sidebar badge showing pending recommendation count"
```

---

### Task 11: Environment variables and final cleanup

**Files:**
- No new files

- [ ] **Step 1: Document required env vars**

The following environment variables need to be set in Vercel:

- `GMAIL_CLIENT_ID` — from Google Cloud Console OAuth credentials
- `GMAIL_CLIENT_SECRET` — from Google Cloud Console OAuth credentials  
- `GMAIL_REFRESH_TOKEN` — obtained from the existing idealista-bot's token.json (the `refresh_token` field)
- `GMAIL_QUERY` — (optional) default: `from:naoresponder@idealista.pt`

The existing `GROQ_API_KEY` and `CRON_SECRET` are already set and reused.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no errors related to the new files.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(idealista): complete recommendations feature - migrate from Python bot"
```
