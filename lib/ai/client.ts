import OpenAI from 'openai'

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

export const AI_MODEL = 'llama-3.3-70b-versatile'
