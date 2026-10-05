import OpenAI from 'openai'
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'

let _client: OpenAI | null = null

export function getAIClient(): OpenAI {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')
    _client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  }
  return _client
}

// Por ordem de preferência. A conta Groq pode não ter acesso a todos (já aconteceu com o
// llama-3.3-70b-versatile), por isso passamos ao seguinte em model_not_found. AI_MODEL
// (opcional, no Vercel) fica à frente para forçar um modelo sem mexer no código.
const MODELS = [process.env.AI_MODEL, 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
  .filter((m, i, all): m is string => !!m && all.indexOf(m) === i)

// Modelos que não existem para esta chave; evita repetir a tentativa a cada pedido.
const unavailable = new Set<string>()

// Os modelos gpt-oss "pensam" antes de responder e esse raciocínio conta para o
// max_tokens. Com limites pequenos (ex.: 5 tokens para "sim"/"não") a resposta vinha vazia,
// por isso reduzimos o esforço de raciocínio e damos margem extra.
const REASONING_HEADROOM = 1024

function adaptParams(model: string, params: Omit<ChatCompletionCreateParamsNonStreaming, 'model'>) {
  if (!model.startsWith('openai/gpt-oss')) return { ...params, model }
  return {
    ...params,
    model,
    reasoning_effort: 'low' as const,
    max_tokens: params.max_tokens ? params.max_tokens + REASONING_HEADROOM : params.max_tokens,
  }
}

export async function createChatCompletion(params: Omit<ChatCompletionCreateParamsNonStreaming, 'model'>) {
  let lastError: unknown
  for (const model of MODELS) {
    if (unavailable.has(model)) continue
    try {
      return await getAIClient().chat.completions.create(adaptParams(model, params))
    } catch (err) {
      if ((err as { code?: string }).code !== 'model_not_found') throw err
      console.error(`[ai] modelo ${model} indisponível para esta chave, a tentar o seguinte`)
      unavailable.add(model)
      lastError = err
    }
  }
  throw lastError ?? new Error('Nenhum modelo de IA disponível')
}
