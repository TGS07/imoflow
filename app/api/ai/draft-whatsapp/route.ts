import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import { buildDraftWhatsAppPrompt } from '@/lib/ai/prompts'
import type { Lead, Activity } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id } = await request.json() as { lead_id: string }
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const [{ data: profile }, { data: lead }, { data: activities }, { data: agency }] = await Promise.all([
    supabase.from('users').select('agency_id, name').eq('id', user.id).single(),
    supabase.from('leads').select('*, pipeline_stages(name)').eq('id', lead_id).single(),
    supabase.from('activities').select('*').eq('lead_id', lead_id).order('created_at', { ascending: false }).limit(10),
    supabase.from('agencies').select('name').single(),
  ])

  if (!profile || !lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const prompt = buildDraftWhatsAppPrompt(
    lead as Lead,
    (activities ?? []) as Activity[],
    profile.name ?? 'Agente',
    agency?.name ?? 'Agência',
  )

  const completion = await getAIClient().chat.completions.create({
    model: AI_MODEL,
    max_tokens: 256,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = completion.choices[0]?.message?.content?.trim() ?? ''
  return NextResponse.json({ draft: text })
}
