import { createChatCompletion } from '@/lib/ai/client'

export type CommitInfo = { sha: string; message: string }

// Devolve de 0 a 6 pontos em PT para clientes. [] = nada relevante para o utilizador.
export async function summarizeCommits(commits: CommitInfo[]): Promise<string[]> {
  if (commits.length === 0) return []

  const list = commits.map(c => `- ${c.message.split('\n')[0]}`).join('\n')

  const completion = await createChatCompletion({
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Escreves as novidades de um CRM imobiliário (FormaCR) para agentes imobiliários em Portugal. ' +
          'Recebes títulos de commits técnicos e devolves JSON {"items": string[]}. ' +
          'Regras: português de Portugal, frases curtas e simples, sem jargão técnico, máximo 6 pontos. ' +
          'Descreve só o que o utilizador final consegue ver ou usar na aplicação: novas funcionalidades, melhorias visíveis e correções de problemas que ele sentia (ecrãs, botões, menus, pipeline, emails, planos). ' +
          'IGNORA SEMPRE e não menciones: performance interna, infraestrutura, base de dados, segurança interna, refactors, limpeza de código, dependências, documentação, testes, CI, deploys, ' +
          'e tudo o que diga respeito ao próprio sistema de novidades ou de envio de emails (por exemplo modelos de IA, fallbacks, resumos, GitHub Actions, Resend). ' +
          'Em caso de dúvida se o utilizador final notaria a mudança, ignora-a. ' +
          'Se nada for relevante para o utilizador final, devolve {"items": []}. Não inventes funcionalidades.',
      },
      { role: 'user', content: `Commits do deploy:\n${list}` },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const parsed: unknown = JSON.parse(raw)
  const items = (parsed as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  return items
    .filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
    .map(i => i.trim())
    .slice(0, 6)
}
