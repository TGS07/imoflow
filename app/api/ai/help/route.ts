// POST /api/ai/help — chat de ajuda sobre o ImoFlow.
// A IA recebe o manual completo como contexto e responde apenas a perguntas
// sobre a app; perguntas fora do tema são recusadas educadamente.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import { buildHelpManualText } from '@/lib/help/manual'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { question?: string; history?: ChatMessage[] }
  const question = body.question?.trim()
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })

  // Histórico limitado às últimas 6 mensagens válidas (contexto barato e suficiente)
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-6)

  const system = [
    'És o assistente de ajuda do ImoFlow, um CRM imobiliário em português europeu.',
    'Responde APENAS a perguntas sobre o ImoFlow e o seu funcionamento, com base no manual abaixo.',
    'Se a pergunta não for sobre o ImoFlow, responde apenas que só podes ajudar com dúvidas sobre a app.',
    'Respostas curtas e práticas: passos numerados quando fizer sentido, sem jargão técnico.',
    'Se o manual não cobrir a dúvida, di-lo honestamente e sugere a secção mais próxima — nunca inventes funcionalidades.',
    '',
    '=== MANUAL DO IMOFLOW ===',
    buildHelpManualText(),
  ].join('\n')

  try {
    const completion = await getAIClient().chat.completions.create({
      model: AI_MODEL,
      max_tokens: 512,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        ...history,
        { role: 'user', content: question },
      ],
    })

    const answer = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!answer) return NextResponse.json({ error: 'AI empty response' }, { status: 500 })
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('AI help error:', err)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 })
  }
}
