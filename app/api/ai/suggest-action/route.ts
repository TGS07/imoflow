import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import { buildSuggestActionPrompt } from '@/lib/ai/prompts'
import type { Lead, Activity } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id } = await request.json() as { lead_id: string }
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: lead }, { data: activities }] = await Promise.all([
    supabase
      .from('leads')
      .select('*, pipeline_stages(name)')
      .eq('id', lead_id)
      .eq('agency_id', profile.agency_id)
      .single(),
    supabase
      .from('activities')
      .select('*')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const prompt = buildSuggestActionPrompt(lead as Lead, (activities ?? []) as Activity[])

  const completion = await getAIClient().chat.completions.create({
    model: AI_MODEL,
    max_tokens: 256,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = completion.choices[0]?.message?.content?.trim() ?? ''

  try {
    const parsed = JSON.parse(text) as { action: string; reason: string; urgency: string }
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'AI parse error', raw: text }, { status: 500 })
  }
}
