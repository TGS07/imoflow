import { getAIClient, AI_MODEL } from '@/lib/ai/client'

export type CommitInfo = { sha: string; message: string }

// Tenta o modelo principal e, se a conta Groq não tiver acesso a ele, os seguintes.
const MODELS = [process.env.RELEASE_AI_MODEL, AI_MODEL, 'openai/gpt-oss-120b', 'llama-3.1-8b-instant']
  .filter((m, i, all): m is string => !!m && all.indexOf(m) === i)

async function complete(messages: { role: 'system' | 'user'; content: string }[]) {
  let lastError: unknown
  for (const model of MODELS) {
    try {
      return await getAIClient().chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages,
      })
    } catch (err) {
      if ((err as { code?: string }).code !== 'model_not_found') throw err
      console.error(`release-notes: modelo ${model} indisponível, a tentar o seguinte`)
      lastError = err
    }
  }
  throw lastError
}

// Devolve de 0 a 6 pontos em PT para clientes. [] = nada relevante para o utilizador.
export async function summarizeCommits(commits: CommitInfo[]): Promise<string[]> {
  if (commits.length === 0) return []

  const list = commits.map(c => `- ${c.message.split('\n')[0]}`).join('\n')

  const completion = await complete([
      {
        role: 'system',
        content:
          'Escreves as novidades de um CRM imobiliário (FormaCR) para agentes imobiliários em Portugal. ' +
          'Recebes títulos de commits técnicos e devolves JSON {"items": string[]}. ' +
          'Regras: português de Portugal, frases curtas e simples, sem jargão técnico, máximo 6 pontos. ' +
          'Descreve só o que o utilizador consegue ver ou usar (novas funcionalidades, melhorias, correções visíveis). ' +
          'Ignora performance interna, infraestrutura, refactors, dependências, documentação e rebrand técnico. ' +
          'Se nada for relevante para o utilizador, devolve {"items": []}. Não inventes funcionalidades.',
      },
      { role: 'user', content: `Commits do deploy:\n${list}` },
  ])

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const parsed: unknown = JSON.parse(raw)
  const items = (parsed as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  return items
    .filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
    .map(i => i.trim())
    .slice(0, 6)
}
