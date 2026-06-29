import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import { buildQualifyLeadPrompt } from '@/lib/ai/prompts'
import type { Lead } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as Partial<Lead> & { lead_id?: string }

  let leadData: Partial<Lead> = body
  if (body.lead_id) {
    const { data: profile } = await supabase
      .from('users')
      .select('agency_id')
      .eq('id', user.id)
      .single()

    const { data: lead } = await supabase
      .from('leads')
      .select('name, source, budget, zone, typology, notes')
      .eq('id', body.lead_id)
      .eq('agency_id', profile?.agency_id ?? '')
      .single()

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    leadData = lead as Partial<Lead>
  }

  const prompt = buildQualifyLeadPrompt(leadData)

  const completion = await getAIClient().chat.completions.create({
    model: AI_MODEL,
    max_tokens: 128,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = completion.choices[0]?.message?.content?.trim() ?? ''

  try {
    const parsed = JSON.parse(text) as { score: number; reason: string }
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'AI parse error', raw: text }, { status: 500 })
  }
}
