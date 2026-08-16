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
