import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createChatCompletion } from '@/lib/ai/client'
import { buildSuggestContactActionPrompt, type ContactAiContext } from '@/lib/ai/prompts'
import type { Person, ContactInteraction } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { person_id } = await request.json() as { person_id: string }
  if (!person_id) return NextResponse.json({ error: 'person_id required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: person }, { data: interactions }, { data: leads }, { data: sellerProps }, { data: buyerProps }] = await Promise.all([
    supabase
      .from('people')
      .select('*')
      .eq('id', person_id)
      .eq('agency_id', profile.agency_id)
      .single(),
    supabase
      .from('contact_interactions')
      .select('*')
      .eq('person_id', person_id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('leads')
      .select('deal_value, budget, stage_entered_at, pipelines(name), pipeline_stages(name, is_won, is_lost)')
      .eq('person_id', person_id),
    supabase.from('properties').select('title, reference, status, visit_activity').eq('seller_id', person_id),
    supabase.from('properties').select('title, reference, status, visit_activity').eq('buyer_id', person_id),
  ])

  if (!person) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  type LeadRow = { deal_value: number | null; budget: number | null; stage_entered_at: string; pipelines: { name: string } | null; pipeline_stages: { name: string; is_won: boolean; is_lost: boolean } | null }
  type PropRow = { title: string; reference: string | null; status: string; visit_activity: string | null }
  const ctx: ContactAiContext = {
    leads: ((leads ?? []) as unknown as LeadRow[])
      .filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
      .map(l => ({
        pipeline: l.pipelines?.name ?? 'Pipeline',
        stage: l.pipeline_stages?.name ?? '—',
        daysInStage: Math.floor((Date.now() - new Date(l.stage_entered_at).getTime()) / 86_400_000),
        value: l.deal_value ?? l.budget,
      })),
    properties: [
      ...((sellerProps ?? []) as PropRow[]).map(p => ({ label: p.reference ? `${p.reference} — ${p.title}` : p.title, role: 'vende', status: p.status, visit_activity: p.visit_activity })),
      ...((buyerProps ?? []) as PropRow[]).map(p => ({ label: p.reference ? `${p.reference} — ${p.title}` : p.title, role: 'comprou', status: p.status, visit_activity: p.visit_activity })),
    ],
  }

  const prompt = buildSuggestContactActionPrompt(person as Person, (interactions ?? []) as ContactInteraction[], ctx)

  const completion = await createChatCompletion({
    max_tokens: 600,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = completion.choices[0]?.message?.content?.trim() ?? ''
  // Alguns modelos embrulham o JSON em ```json … ```
  const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

  try {
    const parsed = JSON.parse(json) as { action: string; reason: string; urgency: string; channel?: string; when?: string; tips?: unknown; next_call_in_days?: unknown }
    return NextResponse.json({
      action: parsed.action,
      reason: parsed.reason,
      urgency: parsed.urgency,
      channel: typeof parsed.channel === 'string' ? parsed.channel : null,
      when: typeof parsed.when === 'string' ? parsed.when : null,
      tips: Array.isArray(parsed.tips) ? parsed.tips.filter((t): t is string => typeof t === 'string').slice(0, 4) : [],
      next_call_in_days: typeof parsed.next_call_in_days === 'number' && parsed.next_call_in_days >= 0 ? Math.round(parsed.next_call_in_days) : null,
    })
  } catch {
    return NextResponse.json({ error: 'AI parse error', raw: text }, { status: 500 })
  }
}
