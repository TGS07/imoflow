import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import { buildInteractionExtractionPrompt } from '@/lib/ai/prompts'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('audio')
  if (!(file instanceof File)) return NextResponse.json({ error: 'audio required' }, { status: 400 })

  const client = getAIClient()
  // 1) transcrição (Groq Whisper)
  const transcription = await client.audio.transcriptions.create({
    file, model: 'whisper-large-v3',
  })
  const transcript = (transcription as { text: string }).text ?? ''

  // 2) extração de tipo + resumo
  const completion = await client.chat.completions.create({
    model: AI_MODEL, max_tokens: 256, temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildInteractionExtractionPrompt(transcript) }],
  })
  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
  let fields: unknown = {}
  try { fields = JSON.parse(raw) } catch { fields = {} }

  return NextResponse.json({ transcript, fields })
}
