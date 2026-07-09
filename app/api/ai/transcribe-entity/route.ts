import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import { buildEntityExtractionPrompt, type VoiceEntity } from '@/lib/ai/prompts'

const VALID_ENTITIES: VoiceEntity[] = ['contact', 'interaction', 'lead', 'organization', 'property', 'activity', 'visit']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('audio')
  const entity = formData.get('entity')
  if (!(file instanceof File)) return NextResponse.json({ error: 'audio required' }, { status: 400 })
  if (typeof entity !== 'string' || !VALID_ENTITIES.includes(entity as VoiceEntity)) {
    return NextResponse.json({ error: 'invalid entity' }, { status: 400 })
  }

  const client = getAIClient()
  // 1) transcrição (Groq Whisper)
  const transcription = await client.audio.transcriptions.create({
    file, model: 'whisper-large-v3',
  })
  const transcript = (transcription as { text: string }).text ?? ''

  // 2) extração de campos, específica da entidade
  const completion = await client.chat.completions.create({
    model: AI_MODEL, max_tokens: 512, temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildEntityExtractionPrompt(entity as VoiceEntity, transcript) }],
  })
  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
  let fields: unknown = {}
  try { fields = JSON.parse(raw) } catch { fields = {} }

  return NextResponse.json({ transcript, fields })
}
